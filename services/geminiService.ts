import { GoogleGenAI, Modality, Type } from "@google/genai";
import { getBrain, getAppSettings } from "./brain";
import { BrainData, TessDayPlan, CampaignStrategy, WeeklyPostPlan, FeedPost, StoryItem, LocationData, TrendCard, VoiceExample, BrandContext, AvatarCandidate, BusinessInfo, AgentTool, BrainUpdateProposal, CampaignPackage, PersonaCV, SprintDuration, FacebookProfile, VisionAnalysisResult, Product, VideoTranscript, VoiceMode } from "../types";

// --- DYNAMIC KEY RETRIEVAL ---
const getApiKey = () => {
    return localStorage.getItem('tess_gemini_key') || process.env.API_KEY;
};

const getKieKey = () => {
    return localStorage.getItem('tess_kie_key');
};

const getAiClient = () => {
    const key = getApiKey();
    if (!key) return null;
    return new GoogleGenAI({ apiKey: key });
};

// --- HELPER: WAIT ---
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function jsonStr(text: string | undefined) {
    if (!text) return null;
    const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (match) return match[1];
    return text;
}

// --- MODEL SELECTOR ---
const getPreferredTextModel = () => 'gemini-3-pro-preview';

// --- PROMPT CONSTRUCTOR ---
export const constructImageGenPrompt = (visualPrompt: string, engine: string, isEnvironment: boolean, brain: BrainData, hasReference: boolean = false): string => {
    const isExplicit360 = visualPrompt.toLowerCase().includes('360') || visualPrompt.toLowerCase().includes('panorama');
    const known360Location = Object.values(brain.locations || {}).find(loc => 
        loc.is360 && visualPrompt.toLowerCase().includes(loc.name.toLowerCase())
    );

    let cleanVisualPrompt = visualPrompt.replace(/hologram|digital overlay|hud|screen|interface|cyber|futuristic|glowing data|floating|virtual|circuit|soft lighting|studio lighting/gi, "");
    if (!isEnvironment) cleanVisualPrompt = cleanVisualPrompt.replace(/screen/gi, "");

    if (!isEnvironment && known360Location) {
        cleanVisualPrompt += `
        [ENVIRONMENT CONTEXT: 360 ROOM SOURCE]
        The setting '${known360Location.name}' is a 360-degree panoramic environment.
        INSTRUCTION: Generate a STANDARD, RECTILINEAR (Flat) photograph taken FROM INSIDE this room.
        - Do NOT generate a sphere or 360 projection.
        - Frame the subject at the specific spot mentioned.
        `;
    }

    if (engine === 'seedream') return cleanVisualPrompt; 

    // --- NANO PRO ---
    if (engine === 'nano-pro' || engine === 'nano-fast') {
        const safeBio = brain.identity?.bio || "A social media manager.";
        
        if (isEnvironment) {
             const shouldUse360Format = isExplicit360 || (known360Location && isEnvironment);
             return `
                ROLE: Professional Architectural Photographer & Interior Stylist.
                TASK: Generate a single, stunning, hyper-realistic photo of a room.
                STYLE: "Architectural Digest" meets "Real Life".
                
                BIO CONTEXT: "${safeBio}"
                CRITICAL VISUAL RULES: NO SCREENS FLOATING. STRAIGHT VERTICAL LINES. ORGANIZED CHAOS.
                ${shouldUse360Format ? '- FORMAT: 360-degree equirectangular panorama projection.' : ''}
                SCENE: ${cleanVisualPrompt}
             `;
        } else {
             // DETECT SELFIE/VLOG INTENT
             const isSelfieOrVlog = /selfie|vlog|talking to camera|speaking to camera|holding the camera|facing camera/i.test(visualPrompt);
             
             const selfieInstruction = isSelfieOrVlog 
                ? "ACTION: Subject is holding the camera at arm's length (Selfie/Vlog angle). DO NOT show a physical camera device in their hands. They are looking into the lens." 
                : "";

             return `
                ROLE: Candid Lifestyle Photographer.
                TASK: Generate an authentic, real-life photo of a person.
                STYLE: "Shot on iPhone", clean aesthetic, natural light, high quality.
                
                SUBJECT:
                A real human. 20-40 years old. 
                Style: Smart Casual / Real world aesthetic. Looks put together and well-groomed.
                
                DIVERSITY POLICY: 
                Unless a specific reference image is provided, prioritize diversity in ethnicity and gender.
                Avoid generic stock photo looks. Make them look unique.
                
                ${hasReference ? "IMPORTANT: Use the provided reference image to determine the subject's facial features, hair color, and ethnicity. Maintain character consistency." : ""}
                
                STRICT NEGATIVE PROMPTS:
                - NO STUDIO LIGHTING. NO EDITORIAL. NO FASHION SHOOT.
                - NO SCI-FI. NO FLOATING SCREENS.
                - NO PLASTIC SKIN. NO AIRBRUSHING.
                - NO HOLDING A CAMERA. NO DSLR IN HANDS. NO CAMERA STRAPS.
                
                CRITICAL VISUAL DETAILS:
                - LIGHTING: Soft, diffused natural window light.
                - SKIN: Natural, healthy, clean skin texture.
                - CAMERA: Smartphone focal length (28mm).
                ${selfieInstruction}
                
                SCENE DESCRIPTION:
                ${cleanVisualPrompt}
             `;
        }
    }
    return cleanVisualPrompt;
};

// --- IMAGE GENERATION ---
export const generateGenAiImage = async (
    visualPrompt: string, 
    useStrictTessStyle: boolean = true, 
    isEnvironment: boolean = false, 
    referenceImage: string | null = null,
    aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '9:16',
    brainOverride?: BrainData // ADDED: Allow passing a specific brain state
): Promise<string | null> => {
    const settings = getAppSettings();
    
    // FIX: Use the override if provided, otherwise fetch global state
    const brain = brainOverride || getBrain();
    
    const hasRef = !!referenceImage;
    let finalPrompt = constructImageGenPrompt(visualPrompt, settings.imageEngine, isEnvironment, brain, hasRef);
    
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey });
    const parts: any[] = [];
    if (referenceImage) {
        try {
            const mimeType = referenceImage.split(';')[0].split(':')[1];
            const base64Data = referenceImage.split(',')[1];
            parts.push({ inlineData: { data: base64Data, mimeType: mimeType } });
        } catch (e) {}
    }
    parts.push({ text: finalPrompt });
    let modelName = 'gemini-3-pro-image-preview';
    let retries = 3;
    while (retries > 0) {
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: { parts },
                config: { responseModalities: [Modality.IMAGE], imageConfig: { aspectRatio: aspectRatio, imageSize: "1K" } }
            });
            const part = response.candidates?.[0]?.content?.parts?.[0];
            if (part && part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            return null;
        } catch (error: any) { 
            if ((error.status === 404 || error.status === 403) && modelName === 'gemini-3-pro-image-preview') {
                 modelName = 'gemini-2.5-flash-image';
                 continue;
            }
            retries--;
            await wait(2000);
        }
    }
    return null;
};

// --- DEEP PERSONA GENERATION (UPDATED) ---

export const generateDeepPersona = async (candidate: AvatarCandidate, voiceMode: VoiceMode, businessInfo: Partial<BusinessInfo>): Promise<any> => {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key missing");

    const backstoryInstruction = candidate.archetype === 'employee'
        ? "They applied to work here. They have a specific role at the company. Talk about their interview or first day. They are NOT the founder."
        : "They NEVER applied to work here. They are a SUPER FAN customer who discovered the brand and became obsessed. Their 'Day Job' is totally unrelated to the brand (e.g. they are a nurse, teacher, builder). They post about the brand purely because they love it, not because they are paid or employed.";

    const prompt = `
        Create a "Deep Persona Bible" for a social media personality.
        This needs to be sitcom-level detailed.
        
        CANDIDATE:
        Name: ${candidate.name}
        Archetype: ${candidate.archetype}
        Day Job / Role: ${candidate.day_job}
        Pronouns: ${candidate.pronouns}
        Personality Mode: ${voiceMode.title}
        
        BRAND CONTEXT:
        Brand: ${businessInfo.name}
        Industry: ${businessInfo.industry}
        What we sell: ${businessInfo.what_we_sell}
        
        TASK:
        Flesh out their life. Be specific. No generic fluff.
        
        ${backstoryInstruction}
        
        CRITICAL: Generate 4-5 expert CONTENT PILLARS that this person would actually post about, based on the company needs and modern social strategy for this specific industry (${businessInfo.industry}).
        Also generate specific HUMOR PILLARS relevant to the ${businessInfo.industry} niche.
        
        OUTPUT JSON:
        {
            "backstory": "Detailed paragraph about their history with the brand/job.",
            "daily_routine": "Detailed run-down of their day (incorporating their Day Job: ${candidate.day_job}). Coffee order, commute, evening ritual.",
            "psychology": {
                "motivation": "A deep, slightly irrational motivation (e.g. 'To prove their high school teacher wrong').",
                "fear": "A specific, funny irrational fear (e.g. 'Accidentally going live on TikTok while eating').",
                "habits": ["Specific physical tic", "Specific phrase they overuse", "Specific app they are addicted to"],
                "hobbies": ["${candidate.hobby || 'Hobby'}", "Another weird hobby"]
            },
            "lore": "A list of 5 specific facts/secrets about them. (e.g. 'Banned from the local library', 'Secretly writes fanfiction').",
            "visual_attributes": {
                "clothing_style": "Detailed description of their fashion sense (incorporating ${candidate.uniform}).",
                "hair_style": "Specific hair description.",
                "facial_features": "Distinctive features.",
                "accessories": "Glasses? Jewellery? Hats?"
            },
            "content_pillars": "1. [Title]: Description...\\n2. [Title]: Description...",
            "humor_pillars": "1. [Title]: Description...\\n2. [Title]: Description..."
        }
    `;

    const response = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: prompt,
        config: { responseMimeType: "application/json" }
    });
    
    return JSON.parse(jsonStr(response.text) || "{}");
};

// --- GALLERY GENERATION (UPDATED) ---

export const generatePersonaGallery = async (candidate: AvatarCandidate, businessInfo: Partial<BusinessInfo>, deepPersona: any): Promise<Array<{id: string, url: string, label: string}>> => {
    const gallery: Array<{id: string, url: string, label: string}> = [];
    const referenceImage = candidate.img;
    
    // Create a temporary brain state to pass the character's visual style to the image generator
    // This ensures consistency even if the main brain hasn't updated yet or if we are just testing
    const tempBrain: any = {
        identity: {
            bio: `Style: ${deepPersona.visual_attributes.clothing_style}. Hair: ${deepPersona.visual_attributes.hair_style}. Features: ${deepPersona.visual_attributes.facial_features}.`
        },
        locations: {}
    };
    
    const workContext = candidate.archetype === 'employee' 
        ? `working at ${businessInfo.name}. Wearing ${candidate.uniform}. Context: ${businessInfo.industry}.`
        : `working at their day job as a ${candidate.day_job}. Wearing professional attire for that role. NOT at the brand office.`;

    const shots = [
        {
            label: "Headshot (Front)",
            prompt: `Close up portrait of ${candidate.name}, facing camera directly. ${deepPersona.visual_attributes.hair_style}. Neutral but warm expression. Simple background. High key lighting.`
        },
        {
            label: "Side Profile",
            prompt: `Side profile shot of ${candidate.name}. Looking to the left. ${deepPersona.visual_attributes.clothing_style}. Natural lighting. Cinematic depth of field.`
        },
        {
            label: candidate.archetype === 'employee' ? "At Work" : "The Day Job",
            prompt: `Medium shot of ${candidate.name} ${workContext}. Busy, authentic environment.`
        },
        {
            label: "The Hobby",
            prompt: `Candid shot of ${candidate.name} doing their hobby: ${candidate.hobby || "hobby"}. Focused expression. messy environment. Authentic lighting.`
        },
        {
            label: "The Pet",
            prompt: `Selfie of ${candidate.name} with their pet: ${candidate.pet || "pet"}. Happy, chaotic energy. At home. Casual clothes.`
        },
        {
            label: "Lifestyle / Routine",
            prompt: `Candid street photography of ${candidate.name} walking in ${candidate.location || "city"}. Holding a coffee. Wearing sunglasses. Golden hour lighting.`
        }
    ];

    for (const shot of shots) {
        try {
            // Pass tempBrain to ensure the image generator uses THIS character's details
            const img = await generateGenAiImage(shot.prompt, true, false, referenceImage, '3:4', tempBrain);
            if (img) {
                gallery.push({
                    id: `GAL_${Date.now()}_${Math.random()}`,
                    url: img,
                    label: shot.label
                });
            }
        } catch (e) {
            console.error(`Failed to generate gallery shot: ${shot.label}`, e);
        }
    }

    return gallery;
};

// --- ENVIRONMENT GENERATION (FIXED) ---

export const generateStarterEnvironments = async (brain: BrainData, onProgress: () => void): Promise<Record<string, LocationData>> => {
    const ai = getAiClient();
    if (!ai) return {};

    const prompt = `
        Based on this brand: ${brain.brand?.name || "Brand"} (${brain.brand?.industry || "Service"}).
        And this persona: ${brain.identity.name} (${brain.identity.role}).
        Vibe: ${brain.styleGuide.persona_definition}
        
        Generate 4 key physical environments (Locations) where content should be filmed.
        One MUST be a "Home" context. One MUST be a "Work" context.
        
        OUTPUT JSON:
        [
            {
                "id": "LOC_1",
                "name": "The Office Desk",
                "visualData": "Detailed description...",
                "defaultContext": "Working context...",
                "is360": false
            }
        ]
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const locsArray = JSON.parse(jsonStr(response.text) || "[]");
        const locsMap: Record<string, LocationData> = {};
        
        await Promise.all(locsArray.map(async (l: any) => {
             const visualPrompt = `MASTER SHOT: ${l.name}. ${l.visualData}. Style: High-end architectural photography. Vibe: ${brain.styleGuide.persona_definition}`;
             
             // CRITICAL FIX: Pass the 'brain' object explicitly so generateGenAiImage uses the NEW persona bio/style
             // This ensures the location matches the newly created persona, not the old/default one.
             const img = await generateGenAiImage(visualPrompt, false, true, null, '16:9', brain);
             
             l.imageUrl = img;
             l.imageUrls = img ? [img] : [];
             locsMap[l.id] = l;
        }));

        return locsMap;
    } catch (e) { return {}; }
};

export const transcribeVideo = async (base64Data: string, mimeType: string): Promise<VideoTranscript | null> => { const ai = getAiClient(); if (!ai) return null; const prompt = `Transcribe this video. Output JSON: { "title": "Title", "transcript": [{ "timestamp": "0:00", "speaker": "A", "dialogue": "..." }] }`; try { const response = await ai.models.generateContent({ model: "gemini-3-pro-preview", contents: { parts: [{ inlineData: { data: base64Data, mimeType } }, { text: prompt }] }, config: { responseMimeType: "application/json" } }); return JSON.parse(jsonStr(response.text) || "null"); } catch (e) { return { title: "Error", transcript: [] }; } };
export const selectBestFrame = async (framesBase64: string[]): Promise<number[]> => { return [0]; };
export const generateHooksFromTranscript = async (t: string) => [{text: "Watch this"}];
export const detectAgentIntent = async (t: string, i: boolean) => AgentTool.CHAT;
export const generateAgentChat = async (t: string, c: string, h: any[]): Promise<{text: string, sources: any[], image?: string}> => ({ text: "I'm here.", sources: [] });
export const generateWeekPlan = async (t: string, i?: any) => ({ posts: [] });
export const generateBrainUpdateProposal = async (t: string) => null;
export const generateTrendReport = async (q: string) => ({ text: "", grounding: [] });
export const analyzeLocationImage = async (d: string, m: string) => "A nice room.";
export const generateVeoVideo = async (p: string, i?: any) => null;
export const generateSmartFill = async (p: any[]) => [];
export const generateStoriesFromFeed = async (p: any[]) => [];
export const generateTrendScript = async (t: any) => null;
export const generateTrainingExamples = async (b: any) => [];
export const generateSocialBios = async (b: string) => [];
export const generateTessWeek = async (b: any, f: string, d: SprintDuration, p: any[], l: any[]) => [];
export const generateTessCard = async (b: any, p: string) => null;
export const generateWeeklyFocusIdeas = async (b: any) => [];
export const analyzeVision = async (d: string, m: string, b?: any) => null;
export const generateCaptionFromImage = async (d: string, m: string, c?: string) => "";
export const generateVeoPrompt = async (d: string, m: string) => "";
export const generateCampaignStrategy = async (p: any, f: string) => ({} as any);
export const generateBulkCampaignPosts = async (p: any, s: any) => [];
export const generateFacebookProfile = async (candidate: any, brand: any) => ({} as any);
export const getPersonaStatus = async () => ({ batteryLevel: 100 });
export const generateBrainFromUrl = async (u: string) => null;
export const processBrainDump = async (t: string, i: any[]) => ({ brand: {}, styleGuide: {}, logoIndex: -1 });
export const processPersonaDump = async (t: string): Promise<any> => ({});
export const conductPersonaInterview = async (h: any[]) => "";
export const generateAvatarSet = async (d: string) => [];
export const generateName = async (n: string) => n;
export const rewriteBio = async (b: string) => b;
export const performInitialResearch = async (url: string): Promise<string> => {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key missing");
    const researchPrompt = `Research this brand URL: ${url}. Find: Brand Name, Industry, What they sell, Target Audience, Tone of Voice, Key Offers. Look for visual style and aesthetics.`;
    const researchResponse = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: researchPrompt,
        config: { tools: [{ googleSearch: {} }] }
    });
    return researchResponse.text || "No data found.";
};
export const generateOnboardingCandidates = async (researchData: string, archetype: 'employee' | 'megafan'): Promise<{ candidates: AvatarCandidate[], brandContext: BrandContext, personaCV: PersonaCV, businessInfo: Partial<BusinessInfo> }> => {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key missing");
    const archetypeInstruction = archetype === 'employee' ? "ARCHETYPE: INTERNAL EMPLOYEE. 'The Insider'. Perspective: 'We'. STRICTLY NO FOUNDERS. This is a staff member (e.g. Social Manager, Stylist, Barista, Assistant)." : "ARCHETYPE: SUPER FAN / CREATOR. 'The Customer'. Perspective: 'I'. The goal is to share an authentic obsession with the product/service. STRICTLY NO EMPLOYEES. This is a customer.";
    const synthesisPrompt = `Based on this research: ${researchData} ${archetypeInstruction} Generate a Brand Scan Report with 5 DISTINCT CANDIDATES. CRITICAL RULES: 1. **DIVERSITY**: The 5 candidates MUST be diverse in gender, ethnicity, and style. 2. **FULL NAMES**: Generate a unique, trustworthy **FULL NAME** (First + Last Name). 3. **LIFE SNAPSHOT**: Use real influencer research to assign a realistic Location, specific Pet (with name), and unusual Hobby. 4. **DETAILS**: Generate Pronouns and Birthday (Month/Day). 5. **JOB ROLE**: - If Employee: Give them a specific staff role (e.g. 'Head Stylist', 'Junior Marketer', 'Barista'). NO FOUNDERS. - If Super Fan: Give them a specific unrelated Day Job (e.g. 'Nurse', 'Accountant', 'Student', 'Graphic Designer'). 6. **UNIFORM/STYLE**: - If Employee: Describe their work uniform or dress code (e.g. 'Black branded apron', 'Smart casual suit'). - If Super Fan: Describe their personal style (e.g. 'Vintage boho', 'Streetwear'). 7. **VOICE MODES**: For EACH candidate, generate 3 specific 'Voice Modes' (Calm, Balanced, Chaotic). OUTPUT JSON: { "businessInfo": { "name": "...", "industry": "...", "tagline": "...", "what_we_sell": "...", "target_audience": "...", "key_offers": ["..."], "competitors": ["..."], "tone_of_voice": "...", "values": "..." }, "brandContext": { "category": "...", "region": "...", "visualSignals": ["..."], "offerTypes": ["..."], "priceTier": "mid", "competitorRefs": [] }, "personaCV": { "audienceArchetype": "...", "fears": ["..."], "desires": ["..."], "priceSensitivity": "mid", "visualTolerance": { "clutter": "mid", "motion": "high", "faceTime": "mid" }, "callToActionRules": ["..."], "bannedAngles": ["..."] }, "candidates": [ { "id": "c1", "name": "Full Name", "pronouns": "She/Her", "birthday": "April 12", "label": "Creative Descriptor", "tagline": "...", "location": "City, Country", "pet": "Pet Type & Name", "hobby": "Specific Unusual Hobby", "day_job": "Specific Role", "uniform": "Description of clothing", "traits": ["..."], "visualPrompt": "A 28 year old [Ethnicity] [Gender] wearing [uniform]...", "skills": ["..."], "mission": "Default mission statement...", "chaosLevel": 40, "sarcasmLevel": 30, "archetype": "${archetype}", "voiceModes": [ { "title": "Calm", "mission": "...", "voiceDescription": "...", "samplePost": "...", "chaosLevel": 10, "sarcasmLevel": 10 }, { "title": "Balanced", "mission": "...", "voiceDescription": "...", "samplePost": "...", "chaosLevel": 50, "sarcasmLevel": 40 }, { "title": "Chaotic", "mission": "...", "voiceDescription": "...", "samplePost": "...", "chaosLevel": 90, "sarcasmLevel": 80 } ] } ] }`;
    const synthesisResponse = await ai.models.generateContent({ model: "gemini-3-pro-preview", contents: synthesisPrompt, config: { responseMimeType: "application/json" } });
    const result = JSON.parse(jsonStr(synthesisResponse.text) || "{}");
    if (result.candidates) { await Promise.all(result.candidates.map(async (c: any) => { const enhancedVisualPrompt = `${c.visualPrompt}. Wearing: ${c.uniform}.`; const img = await generateGenAiImage(enhancedVisualPrompt, true, false, null, '3:4'); c.img = img; })); }
    return { candidates: result.candidates || [], brandContext: result.brandContext || {}, personaCV: result.personaCV || {}, businessInfo: result.businessInfo || {} };
};
export const performBrandScan = async (url: string) => { const research = await performInitialResearch(url); return generateOnboardingCandidates(research, 'employee'); };