

import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import { getBrain, getAppSettings } from "./brain";
import { BrainData, TessDayPlan, CampaignStrategy, WeeklyPostPlan, FeedPost, StoryItem, LocationData, TrendCard, VoiceExample, BrandContext, AvatarCandidate, BusinessInfo, AgentTool, BrainUpdateProposal, CampaignPackage, PersonaCV, SprintDuration, FacebookProfile, VisionAnalysisResult, Product, VideoTranscript, VoiceMode } from "../types";

// --- DYNAMIC KEY RETRIEVAL ---
const getApiKey = () => {
    return localStorage.getItem('tess_gemini_key') || process.env.API_KEY;
};

const getAiClient = () => {
    const key = getApiKey();
    if (!key) return null;
    return new GoogleGenAI({ apiKey: key });
};

// --- HELPER: GET TEXT MODEL ---
const getTextModel = (): string => {
    const settings = getAppSettings();
    if (settings.modelTier === 'pro') {
        return 'gemini-3-pro-preview';
    }
    return 'gemini-2.5-flash';
};

// --- HELPER: WAIT ---
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// --- HELPER: RETRY OPERATION (Optimized for Speed) ---
const retryOperation = async <T>(operation: () => Promise<T>, retries = 6, baseDelay = 500): Promise<T> => {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
        try {
            return await operation();
        } catch (error: any) {
            lastError = error;
            
            // Deep inspection of error object to catch various Google SDK error formats
            const status = error.status || error.response?.status || error.error?.code;
            const message = (error.message || error.error?.message || JSON.stringify(error)).toLowerCase();
            const statusText = (error.statusText || error.error?.status || '').toLowerCase();

            // Handle Overloaded (503), Rate Limit (429), Internal Error (500), or specific overload messages
            const isOverloaded = 
                status === 503 || 
                status === 429 || 
                status === 500 || 
                message.includes('overloaded') || 
                message.includes('unavailable') ||
                message.includes('resource exhausted') ||
                statusText === 'unavailable';

            if (isOverloaded) {
                // Exponential backoff with jitter: 0.5s, 1s, 2s... (Fast recovery)
                const delay = baseDelay * Math.pow(1.5, i) + (Math.random() * 200);
                console.warn(`Gemini API Busy (Attempt ${i + 1}/${retries}). Retrying in ${Math.round(delay)}ms...`);
                await wait(delay);
                continue;
            }
            
            // If it's a 400 error (Bad Request), don't retry, just throw
            if (status >= 400 && status < 500 && status !== 429) {
                throw error;
            }
            
            // For other unknown errors, we might retry once just in case
            if (i < 1) {
                 await wait(baseDelay);
                 continue;
            }
            
            throw error;
        }
    }
    throw lastError;
};

function jsonStr(text: string | undefined) {
    if (!text) return null;
    const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    if (match) return match[1];
    return text;
}

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

    // --- NANO PRO / FLASH IMAGE ---
    // Note: 'nano-pro' maps to Pro model, 'nano-fast' maps to Flash image model
    if (engine === 'nano-pro' || engine === 'nano-fast') {
        const safeBio = brain.identity?.bio || "A social media manager.";
        
        if (isEnvironment) {
             // STRICT ENVIRONMENT RULES (FOR 360 GENERATOR COMPATIBILITY)
             const shouldUse360Format = isExplicit360 || (known360Location && isEnvironment);
             return `
                ROLE: Interior Designer & Architectural Photographer.
                TASK: Generate a single, stunning, photo-realistic image of a room.
                STYLE: Authentic, Lived-in, Candid. NOT a showroom. NOT Ikea catalog. NOT perfect.
                
                BIO CONTEXT: "${safeBio}"
                
                CRITICAL VISUAL RULES: 
                - **EMPTY ROOM. ABSOLUTELY NO PEOPLE. NO HUMANS. NO PETS. NO SELFIES.**
                - **NO BODY PARTS (Hands, Legs, Feet, Reflections in mirrors).**
                - **INVISIBLE CAMERA.**
                - **LIVED-IN DETAILS:** Slight mess is good. A coffee cup on a table. A slightly wrinkled rug. Magazines not perfectly aligned. It must look like a REAL home, not a render.
                - NO SCREENS FLOATING. STRAIGHT VERTICAL LINES. 
                
                NEGATIVE PROMPT: People, Person, Man, Woman, Child, Human, Silhouette, Ghost, Shadow of person, Showroom, Ikea Catalog, Perfect, 3D Render, Staged, Sterile, Selfie, Hands, Arms, Legs, Feet, Body parts, Reflection of person, Mirror selfie, Crowd, Text, Overlay, Watermark, Split screen, Collage.
                
                ${shouldUse360Format ? '- FORMAT: 360-degree equirectangular panorama projection.' : ''}
                SCENE: ${cleanVisualPrompt}
             `;
        } else {
             // DETECT SELFIE/VLOG INTENT
             const isSelfieOrVlog = /selfie|vlog|talking to camera|speaking to camera|holding the camera|facing camera/i.test(visualPrompt);
             
             const selfieInstruction = isSelfieOrVlog 
                ? "ACTION: Subject is holding the camera at arm's length (Selfie/Vlog angle). DO NOT show a physical camera device in their hands. They are looking into the lens." 
                : "";

             // SMART SUBJECT DEFINITION
             // If we have a specific persona definition in the brain, use it.
             const personaDefinition = brain.styleGuide?.persona_definition || "";
             const hasSpecificPersona = personaDefinition.length > 10;

             let subjectDescription = `
                SUBJECT:
                A real human. 20-40 years old. 
                Style: Smart Casual / Real world aesthetic. Looks put together and well-groomed.
                
                DIVERSITY POLICY: 
                Unless a specific reference image is provided, prioritize diversity in ethnicity and gender.
                Avoid generic stock photo looks. Make them look unique.
             `;

             if (hasSpecificPersona) {
                 subjectDescription = `
                SUBJECT DESCRIPTION (STRICT):
                ${personaDefinition}
                Name: ${brain.identity.name}
                
                INSTRUCTION: Adhere strictly to the physical description above (Hair Color, Hair Style, Ethnicity, Features).
                 `;
             }

             // ENFORCE FACE CONSISTENCY
             const faceLockInstruction = hasReference 
                ? `
                CRITICAL FACE LOCK:
                - You MUST generate the EXACT SAME PERSON as the reference image.
                - Copy Facial Features, Bone Structure, Eye Color, and Hair Texture exactly.
                - If the reference shows specific clothing, maintain that style unless specified otherwise.
                ` 
                : "";

             return `
                ROLE: Candid Lifestyle Photographer.
                TASK: Generate an authentic, real-life photo of a person.
                STYLE: "Shot on iPhone", clean aesthetic, natural light, high quality.
                
                ${subjectDescription}
                
                ${faceLockInstruction}
                
                STRICT NEGATIVE PROMPTS (CRITICAL):
                - **NO SPLIT SCREENS. NO COLLAGES. NO MONTAGES.**
                - **NO TEXT OVERLAYS. NO WATERMARKS. NO WORDS.**
                - NO STUDIO LIGHTING. NO EDITORIAL. NO FASHION SHOOT.
                - NO SCI-FI. NO FLOATING SCREENS.
                - NO PLASTIC SKIN. NO AIRBRUSHING.
                - NO HOLDING A CAMERA. NO DSLR IN HANDS. NO CAMERA STRAPS.
                
                CRITICAL VISUAL DETAILS:
                - LIGHTING: Soft, diffused natural window light.
                - SKIN: Natural, healthy, clean skin texture.
                - CAMERA: Smartphone focal length (28mm).
                - COMPOSITION: SINGLE FULL FRAME IMAGE.
                ${selfieInstruction}
                
                SCENE DESCRIPTION:
                ${cleanVisualPrompt}
             `;
        }
    }
    return cleanVisualPrompt;
};

// --- IMAGE GENERATION (SMART FALLBACK) ---
export const generateGenAiImage = async (
    visualPrompt: string, 
    useStrictTessStyle: boolean = true, 
    isEnvironment: boolean = false, 
    referenceImage: string | null = null,
    aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '9:16',
    brainOverride?: BrainData 
): Promise<string | null> => {
    const settings = getAppSettings();
    const brain = brainOverride || getBrain();
    const hasRef = !!referenceImage;
    
    // Always get the latest engine setting
    const engine = settings.imageEngine || 'nano-fast';
    
    let finalPrompt = constructImageGenPrompt(visualPrompt, engine, isEnvironment, brain, hasRef);
    
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing");
    const ai = new GoogleGenAI({ apiKey });
    
    const parts: any[] = [];
    if (referenceImage) {
        try {
            // Support both full data URL and just base64
            let mimeType = 'image/jpeg';
            let base64Data = referenceImage;
            
            if (referenceImage.includes('data:')) {
                mimeType = referenceImage.split(';')[0].split(':')[1];
                base64Data = referenceImage.split(',')[1];
            }
            parts.push({ inlineData: { data: base64Data, mimeType: mimeType } });
        } catch (e) {
            console.error("Failed to parse reference image", e);
        }
    }
    parts.push({ text: finalPrompt });

    // MODEL STRATEGY: 
    // 'nano-fast' -> 'gemini-2.5-flash-image'
    // 'nano-pro' -> 'gemini-3-pro-image-preview'
    let modelName = 'gemini-2.5-flash-image'; 
    if (engine === 'nano-pro') {
        modelName = 'gemini-3-pro-image-preview';
    }

    let retries = 3; 
    let delay = 500;

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
            const status = error.status || error.response?.status || error.error?.code;
            
            // SMART FALLBACK: If Pro is busy/404, switch to Flash IMMEDIATELY
            if ((status === 503 || status === 429 || status === 404 || status === 403) && modelName === 'gemini-3-pro-image-preview') {
                 console.warn("Pro Model Overloaded. Switching to Flash Image for speed.");
                 modelName = 'gemini-2.5-flash-image';
                 await wait(500); // Short pause before retry
                 continue; // Retry loop with new model
            }

            console.error(`Image Gen Error (${modelName}):`, error);
            retries--;
            if (retries > 0) await wait(delay);
        }
    }
    return null;
};

// --- DEEP PERSONA GENERATION ---

export const generateDeepPersona = async (candidate: AvatarCandidate, voiceMode: VoiceMode, businessInfo: Partial<BusinessInfo>): Promise<any> => {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key missing");

    const backstoryInstruction = candidate.archetype === 'employee'
        ? "They applied to work here. They have a specific role at the company. Talk about their interview or first day. They are NOT the founder."
        : "They NEVER applied to work here. They are a SUPER FAN customer who discovered the brand and became obsessed. Their 'Day Job' is totally unrelated to the brand. They post about the brand purely because they love it, not because they are paid.";

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
            "backstory": "Detailed paragraph about their history with the brand/job. If Super Fan, mention how they found the product.",
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

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: getTextModel(), // DYNAMIC MODEL
        contents: prompt,
        config: { responseMimeType: "application/json" }
    }));
    
    return JSON.parse(jsonStr(response.text) || "{}");
};

export const generatePersonaGallery = async (candidate: AvatarCandidate, businessInfo: Partial<BusinessInfo>, deepPersona: any, locations: Record<string, LocationData> = {}): Promise<Array<{id: string, url: string, label: string}>> => {
    const gallery: Array<{id: string, url: string, label: string}> = [];
    const referenceImage = candidate.img;
    
    // Create a temporary brain state to pass the character's visual style to the image generator
    const tempBrain: any = {
        identity: {
            bio: `Style: ${deepPersona.visual_attributes.clothing_style}. Hair: ${deepPersona.visual_attributes.hair_style}. Features: ${deepPersona.visual_attributes.facial_features}.`,
            name: candidate.name
        },
        styleGuide: {
            persona_definition: `Name: ${candidate.name}. Hair: ${deepPersona.visual_attributes.hair_style}. Style: ${deepPersona.visual_attributes.clothing_style}. Features: ${deepPersona.visual_attributes.facial_features}.`
        },
        locations: {} 
    };
    
    // Extract visual descriptions from locations to use as backgrounds
    const homeVisual = Object.values(locations).find(l => l.name.toLowerCase().includes('home') || l.name.toLowerCase().includes('living'))?.visualData || "Cozy modern apartment, lived-in, slightly messy.";
    const workVisual = Object.values(locations).find(l => l.name.toLowerCase().includes('work') || l.name.toLowerCase().includes('office'))?.visualData || "Modern workspace, organized chaos.";
    
    const workContext = candidate.archetype === 'employee' 
        ? `working at ${businessInfo.name}. Wearing ${candidate.uniform}. Context: ${businessInfo.industry}.`
        : `working at their day job as a ${candidate.day_job}. Wearing professional attire for that role. NOT at the brand office.`;

    // IMPORTANT: Inject physical description into EVERY prompt to ensure consistency
    const physicalDesc = `Subject: ${candidate.name}. ${deepPersona.visual_attributes.hair_style}. ${deepPersona.visual_attributes.facial_features}.`;

    const shots = [
        {
            label: "Headshot (Front)",
            prompt: `${physicalDesc} Close up portrait, facing camera directly. Neutral but warm expression. Simple background. High key lighting.`
        },
        {
            label: "Side Profile",
            prompt: `${physicalDesc} Side profile shot. Looking to the left. ${deepPersona.visual_attributes.clothing_style}. Natural lighting. Cinematic depth of field.`
        },
        {
            label: candidate.archetype === 'employee' ? "At Work" : "The Day Job",
            prompt: `${physicalDesc} Medium shot of them ${workContext}. Background: ${workVisual}. Busy, authentic environment.`
        },
        {
            label: "The Hobby",
            prompt: `${physicalDesc} Candid shot of them doing their hobby: ${candidate.hobby || "hobby"}. Focused expression. Authentic lighting.`
        },
        {
            label: "The Pet",
            prompt: `${physicalDesc} Selfie with their pet: ${candidate.pet || "pet"}. Happy, chaotic energy. Background: ${homeVisual}. Casual clothes.`
        },
        {
            label: "Lifestyle / Routine",
            prompt: `${physicalDesc} Candid street photography, walking in ${candidate.location || "city"}. Holding a coffee. Wearing sunglasses. Golden hour lighting.`
        }
    ];

    // Parallel generation for speed (since we use Flash now, parallel is safer)
    await Promise.all(shots.map(async (shot) => {
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
    }));

    return gallery;
};

// --- ENVIRONMENT GENERATION (STRICT NO PEOPLE) ---

export const generateStarterEnvironments = async (brain: BrainData, onProgress: () => void): Promise<Record<string, LocationData>> => {
    const ai = getAiClient();
    if (!ai) return {};

    const prompt = `
        Based on this brand: ${brain.brand?.name || "Brand"} (${brain.brand?.industry || "Service"}).
        And this persona: ${brain.identity.name} (${brain.identity.role}).
        Vibe: ${brain.styleGuide?.persona_definition || "Authentic"}.
        
        Generate 4 key physical environments (Locations) where content should be filmed.
        
        CRITICAL RULES:
        1. **NO HUMANS. NO PEOPLE. The rooms must be EMPTY.**
        2. Style: AUTHENTIC, LIVED-IN, REALISTIC. 
           - **NOT** a showroom. **NOT** Ikea Catalog perfection.
           - Add details like: a slightly ruffled rug, a coffee cup on a table, books not perfectly aligned, a charging cable visible.
           - It should look like a real person lives/works there.
        3. One MUST be a "Home" context. One MUST be a "Work" context.
        4. **ENVIRONMENTS MUST MATCH THE BRAND INDUSTRY.**
           - If 'Children/Parenting' -> Nursery, Messy Living Room (toys on floor), Playroom.
           - If 'Fitness' -> Gym, Kitchen (meal prep mess), Park.
           - If 'Corporate' -> Office Desk (papers, coffee), Meeting Room.
        
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
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: "gemini-2.5-flash", // FAST MODEL (Environments are fine with Flash)
            contents: prompt,
            config: { responseMimeType: "application/json" }
        }));
        const locsArray = JSON.parse(jsonStr(response.text) || "[]");
        const locsMap: Record<string, LocationData> = {};
        
        await Promise.all(locsArray.map(async (l: any) => {
             // Force "EMPTY ROOM" into the visual prompt for the image generator
             const visualPrompt = `MASTER SHOT: ${l.name}. ${l.visualData}. Style: Authentic, lived-in home/office. Not staged. High quality. EMPTY ROOM. NO PEOPLE. NO BODY PARTS.`;
             
             // CRITICAL FIX: Pass the 'brain' object explicitly and set isEnvironment=true
             const img = await generateGenAiImage(visualPrompt, false, true, null, '16:9', brain);
             
             l.imageUrl = img;
             l.imageUrls = img ? [img] : [];
             locsMap[l.id] = l;
        }));

        return locsMap;
    } catch (e) { return {}; }
};

export const transcribeVideo = async (base64Data: string, mimeType: string): Promise<VideoTranscript | null> => { 
    const ai = getAiClient(); 
    if (!ai) return null; 
    const prompt = `Transcribe this video. Output JSON: { "title": "Title", "transcript": [{ "timestamp": "0:00", "speaker": "A", "dialogue": "..." }] }`; 
    try { 
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({ 
            model: "gemini-2.5-flash", 
            contents: { parts: [{ inlineData: { data: base64Data, mimeType } }, { text: prompt }] }, 
            config: { responseMimeType: "application/json" } 
        })); 
        return JSON.parse(jsonStr(response.text) || "null"); 
    } catch (e) { return { title: "Error", transcript: [] }; } 
};

export const selectBestFrame = async (framesBase64: string[]): Promise<number[]> => { return [0]; };
export const generateHooksFromTranscript = async (t: string) => [{text: "Watch this"}];
export const detectAgentIntent = async (t: string, i: boolean) => AgentTool.CHAT;

export const generateAgentChat = async (t: string, c: string, h: any[]): Promise<{text: string, sources: any[], image?: string}> => {
    const ai = getAiClient();
    if (!ai) return { text: "Offline.", sources: [] };
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: getTextModel(), // DYNAMIC MODEL
            contents: `Context: ${c}\nHistory: ${JSON.stringify(h)}\nUser: ${t}`,
        }));
        return { text: response.text || "I'm processing...", sources: [] };
    } catch (e) { return { text: "Error.", sources: [] }; }
};

export const generateWeekPlan = async (t: string, i?: any) => ({ posts: [] });
export const generateBrainUpdateProposal = async (t: string) => null;

export const generateSocialBios = async (currentBio: string): Promise<{style: string, text: string}[]> => {
    const ai = getAiClient();
    if (!ai) return [];
    
    const prompt = `
        Rewrite this social media bio: "${currentBio}".
        Create 3 distinct versions:
        1. Professional & Clean
        2. Witty & Relatable
        3. Short & Punchy (Minimalist)
        
        OUTPUT JSON:
        [
            { "style": "Professional", "text": "..." },
            { "style": "Witty", "text": "..." },
            { "style": "Minimalist", "text": "..." }
        ]
    `;
    
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: "gemini-2.5-flash", // Bio generation is fast task
            contents: prompt,
            config: { responseMimeType: "application/json" }
        }));
        return JSON.parse(jsonStr(response.text) || "[]");
    } catch (e) {
        return [];
    }
};

export const generateTrendReport = async (q: string) => {
    const ai = getAiClient();
    if (!ai) return { text: "", grounding: [] };
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: getTextModel(), // DYNAMIC MODEL (Reasoning helpful for trends)
            contents: `Find current social media trends about: ${q}. Format: TREND_CARD: Title | Origin | Vibe | Strategy`,
            config: { tools: [{ googleSearch: {} }] }
        }));
        return { text: response.text || "", grounding: [] };
    } catch (e) { return { text: "Error fetching trends.", grounding: [] }; }
};

export const analyzeLocationImage = async (d: string, m: string) => "A nice room.";
export const generateVeoVideo = async (p: string, i?: any) => null;

export const generateSmartFill = async (currentPosts: any[]): Promise<any[]> => {
    const ai = getAiClient();
    if (!ai) return [];
    
    // Create a context of existing posts
    const context = currentPosts.filter(p => p.caption).map(p => p.caption).join(" || ");
    const brain = getBrain();
    
    const prompt = `
        You are ${brain.identity.name}.
        Analyze the current feed: "${context}".
        
        Generate 3 distinct content ideas to fill the gaps.
        They must be visual, on-brand for ${brain.brand.name}, and varied.
        
        OUTPUT JSON:
        [
            {
                "category": "Behind the Scenes",
                "caption": "Caption text here...",
                "hashtags": ["#tag1", "#tag2"],
                "visualPrompt": "Detailed visual description for image generation..."
            }
        ]
    `;
    
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: getTextModel(), // DYNAMIC MODEL
            contents: prompt,
            config: { responseMimeType: "application/json" }
        }));
        return JSON.parse(jsonStr(response.text) || "[]");
    } catch (e) {
        console.error("Smart Fill Error", e);
        return [];
    }
};

export const generateStoriesFromFeed = async (p: any[]) => [];
export const generateTrendScript = async (t: any) => null;
export const generateTrainingExamples = async (b: any) => [];

export const generateTessWeek = async (brain: BrainData, focus: string, duration: SprintDuration, products: Product[], launchAssets: string[]): Promise<TessDayPlan[]> => {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key missing");

    // NEW LOGIC: Use the Defined Strategy Pillars if they exist
    let strategyContext = "";
    if (brain.strategy?.active_pillars && brain.strategy.active_pillars.length > 0) {
        strategyContext = `
        MANDATORY CONTENT STRATEGY:
        You MUST strictly rotate through these 5 Pillars. Do NOT invent new formats.
        ${brain.strategy.active_pillars.map((p, i) => `${i+1}. ${p.title} (${p.format}): ${p.description}. Hook Style: ${p.hookStyle}.`).join('\n')}
        `;
    }

    const prompt = `
        Act as ${brain.identity.name}, the ${brain.identity.role} for ${brain.brand.name}.
        Tone: ${brain.identity.voice.tone}.
        
        TASK:
        Create a ${duration}-Day Content Sprint.
        Focus: "${focus}".
        
        ${strategyContext}
        
        CRITICAL VISUAL RULES:
        - visualPrompt MUST be detailed for an AI Image Generator.
        - If "Notes App", describe: "Digital Screenshot of Apple Notes app. Yellow background. Text: [Insert Text]. NO HANDS. NO PHONE."
        - If "Vlog", describe: "Candid selfie style photo of ${brain.identity.name}...".
        
        OUTPUT JSON:
        [
            {
                "day": 1,
                "pillar": "Title of Pillar used",
                "format": "Static",
                "hook": "The text on the image/video",
                "caption": "The caption for the post...",
                "visualPrompt": "Detailed AI image prompt...",
                "thumbnailHeadline": "Short text for UI preview",
                "whyItWorks": "Strategy reasoning",
                "assetType": "generate",
                "veoPrompt": "Prompt for video generation if needed",
                "script": "Script if video...",
                "textOverlay": "Text to go on image",
                "nanoModel": "nano-pro"
            }
        ]
    `;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: getTextModel(), // DYNAMIC MODEL (Critical for strategy)
        contents: prompt,
        config: { responseMimeType: "application/json" }
    }));
    
    return JSON.parse(jsonStr(response.text) || "[]");
};

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
    
    const researchResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
        model: getTextModel(), // DYNAMIC MODEL
        contents: researchPrompt,
        config: { tools: [{ googleSearch: {} }] }
    }));
    return researchResponse.text || "No data found.";
};

export const generateOnboardingCandidates = async (researchData: string, archetype: 'employee' | 'megafan'): Promise<{ candidates: AvatarCandidate[], brandContext: BrandContext, personaCV: PersonaCV, businessInfo: Partial<BusinessInfo> }> => {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key missing");
    const archetypeInstruction = archetype === 'employee' ? "ARCHETYPE: INTERNAL EMPLOYEE. 'The Insider'. Perspective: 'We'. STRICTLY NO FOUNDERS. This is a staff member (e.g. Social Manager, Stylist, Barista, Assistant)." : "ARCHETYPE: SUPER FAN / CREATOR. 'The Customer'. Perspective: 'I'. The goal is to share an authentic obsession with the product/service. STRICTLY NO EMPLOYEES. This is a customer.";
    
    // BRAND-PERSONA ALIGNMENT LOGIC
    const brandAlignment = `
        ANALYZE THE INDUSTRY:
        - If Brand is Kids/Baby/Parenting -> Persona MUST be a Parent (Mom/Dad). Vibe: Tired, loving, chaotic but cozy. NO 'Gen Z' slang if targeting Moms.
        - If Brand is Tech/Crypto -> Persona should be Tech-savvy. Vibe: Modern, sharp.
        - If Brand is Beauty -> Persona should be polished/aesthetic.
        
        MATCH THE PERSONA TO THE BRAND DEMOGRAPHIC.
    `;

    const synthesisPrompt = `
        Based on this research: ${researchData} 
        ${archetypeInstruction}
        ${brandAlignment}
        
        Generate a Brand Scan Report with 5 DISTINCT CANDIDATES. 
        CRITICAL RULES: 
        1. **DIVERSITY**: The 5 candidates MUST be diverse in gender, ethnicity, and style. 
        2. **FULL NAMES**: Generate a unique, trustworthy **FULL NAME** (First + Last Name). 
        3. **LIFE SNAPSHOT**: Use real influencer research to assign a realistic Location, specific Pet (with name), and unusual Hobby. 
        4. **DETAILS**: Generate Pronouns and Birthday (Month/Day). 
        5. **JOB ROLE**: 
           - If Employee: Give them a specific staff role (e.g. 'Head Stylist', 'Junior Marketer', 'Barista'). NO FOUNDERS. 
           - If Super Fan: Give them a specific unrelated Day Job (e.g. 'Nurse', 'Accountant', 'Student', 'Graphic Designer'). 
        6. **UNIFORM/STYLE**: 
           - If Employee: Describe their work uniform or dress code (e.g. 'Black branded apron', 'Smart casual suit'). 
           - If Super Fan: Describe their personal style (e.g. 'Vintage boho', 'Streetwear'). 
        7. **VOICE MODES**: For EACH candidate, generate 3 specific 'Voice Modes' (Calm, Balanced, Chaotic). 
        
        OUTPUT JSON: { "businessInfo": { "name": "...", "industry": "...", "tagline": "...", "what_we_sell": "...", "target_audience": "...", "key_offers": ["..."], "competitors": ["..."], "tone_of_voice": "...", "values": "..." }, "brandContext": { "category": "...", "region": "...", "visualSignals": ["..."], "offerTypes": ["..."], "priceTier": "mid", "competitorRefs": [] }, "personaCV": { "audienceArchetype": "...", "fears": ["..."], "desires": ["..."], "priceSensitivity": "mid", "visualTolerance": { "clutter": "mid", "motion": "high", "faceTime": "mid" }, "callToActionRules": ["..."], "bannedAngles": ["..."] }, "candidates": [ { "id": "c1", "name": "Full Name", "pronouns": "She/Her", "birthday": "April 12", "label": "Creative Descriptor", "tagline": "...", "location": "City, Country", "pet": "Pet Type & Name", "hobby": "Specific Unusual Hobby", "day_job": "Specific Role", "uniform": "Description of clothing", "traits": ["..."], "visualPrompt": "A 28 year old [Ethnicity] [Gender] wearing [uniform]...", "skills": ["..."], "mission": "Default mission statement...", "chaosLevel": 40, "sarcasmLevel": 30, "archetype": "${archetype}", "voiceModes": [ { "title": "Calm", "mission": "...", "voiceDescription": "...", "samplePost": "...", "chaosLevel": 10, "sarcasmLevel": 10 }, { "title": "Balanced", "mission": "...", "voiceDescription": "...", "samplePost": "...", "chaosLevel": 50, "sarcasmLevel": 40 }, { "title": "Chaotic", "mission": "...", "voiceDescription": "...", "samplePost": "...", "chaosLevel": 90, "sarcasmLevel": 80 } ] } ] }`;
    
    const synthesisResponse = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({ model: getTextModel(), contents: synthesisPrompt, config: { responseMimeType: "application/json" } }));
    const result = JSON.parse(jsonStr(synthesisResponse.text) || "{}");
    if (result.candidates) { 
        await Promise.all(result.candidates.map(async (c: any, index: number) => { 
            // FIX: Generate unique IDs to prevent collisions when loading more candidates
            c.id = `candidate_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
            
            const enhancedVisualPrompt = `${c.visualPrompt}. Wearing: ${c.uniform}.`; 
            // Candidate cards use 3:4 portrait
            const img = await generateGenAiImage(enhancedVisualPrompt, true, false, null, '3:4'); 
            c.img = img; 
        })); 
    }
    return { candidates: result.candidates || [], brandContext: result.brandContext || {}, personaCV: result.personaCV || {}, businessInfo: result.businessInfo || {} };
};
export const performBrandScan = async (url: string) => { const research = await performInitialResearch(url); return generateOnboardingCandidates(research, 'employee'); };