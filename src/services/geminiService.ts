import { GoogleGenAI, Modality, Type, GenerateContentResponse } from "@google/genai";
import { getBrain, getAppSettings } from "./brain";
import { BrainData, TessDayPlan, FeedPost, StoryItem, LocationData, TrendCard, BrandContext, AvatarCandidate, BusinessInfo, AgentTool, PersonaCV, SprintDuration, VisionAnalysisResult, Product, VideoTranscript, VoiceMode, ContentScenario } from "../types";

const getApiKey = () => localStorage.getItem('tess_gemini_key') || process.env.API_KEY;
const getAiClient = () => { const key = getApiKey(); return key ? new GoogleGenAI({ apiKey: key }) : null; };
const getTextModel = (): string => getAppSettings().modelTier === 'pro' ? 'gemini-3-pro-preview' : 'gemini-2.5-flash';
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryOperation = async <T>(operation: () => Promise<T>, retries = 6, baseDelay = 500): Promise<T> => {
    let lastError: any;
    for (let i = 0; i < retries; i++) {
        try { return await operation(); } 
        catch (error: any) {
            lastError = error;
            const status = error.status || error.response?.status;
            if (status === 503 || status === 429) { await wait(baseDelay * Math.pow(1.5, i)); continue; }
            const statusNum = Number(status);
            if (!isNaN(statusNum) && statusNum >= 400 && statusNum < 500 && statusNum !== 429) throw error;
            if (i < 1) { await wait(baseDelay); continue; }
            throw error;
        }
    }
    throw lastError;
};

function jsonStr(text: string | undefined) {
    if (!text) return null;
    const match = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/);
    return match ? match[1] : text;
}

// --- VISUAL DNA INJECTION ---
export const constructImageGenPrompt = (visualPrompt: string, engine: string, isEnvironment: boolean, brain: BrainData, hasReference: boolean = false): string => {
    const isExplicit360 = visualPrompt.toLowerCase().includes('360') || visualPrompt.toLowerCase().includes('panorama');
    const safeBio = brain.identity?.bio || "A social media manager.";
    
    // SUBLIMINAL BRANDING: Inject Hex Codes as "Atmosphere"
    const palette = brain.styleGuide?.color_palette || [];
    const colorInjection = palette.length > 0 
        ? `BRAND AESTHETIC (SUBLIMINAL): The scene should subtly feature these color tones: ${palette.join(', ')}. Do not force them, but prefer them for clothing, props, or lighting.` 
        : "";

    if (isEnvironment) {
            return `
            ROLE: Interior Designer. TASK: Generate a photo-realistic room.
            BIO CONTEXT: "${safeBio}"
            ${colorInjection}
            CRITICAL: **EMPTY ROOM. NO PEOPLE. NO HUMANS.** Lived-in, authentic style.
            ${isExplicit360 ? '- FORMAT: 360-degree panorama.' : ''}
            SCENE: ${visualPrompt}
            `;
    } else {
            return `
            ROLE: Candid Photographer. TASK: Authentic photo of ${brain.identity.name}.
            STYLE: "Shot on iPhone", clean aesthetic, natural light.
            ${colorInjection}
            STRICT NEGATIVE: NO SPLIT SCREENS. NO TEXT. NO CARTOON.
            SCENE: ${visualPrompt}
            `;
    }
};

export const generateGenAiImage = async (visualPrompt: string, useStrictTessStyle: boolean = true, isEnvironment: boolean = false, referenceImage: string | null = null, aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '9:16', brainOverride?: BrainData): Promise<string | null> => {
    const settings = getAppSettings();
    const brain = brainOverride || getBrain();
    const finalPrompt = constructImageGenPrompt(visualPrompt, settings.imageEngine, isEnvironment, brain, !!referenceImage);
    const ai = getAiClient();
    if (!ai) throw new Error("API Key missing");
    
    const parts: any[] = [{ text: finalPrompt }];
    if (referenceImage) {
        try {
            const base64Data = referenceImage.includes('data:') ? referenceImage.split(',')[1] : referenceImage;
            const mimeType = referenceImage.includes(';') ? referenceImage.split(';')[0].split(':')[1] : 'image/jpeg';
            parts.push({ inlineData: { data: base64Data, mimeType } });
        } catch(e) {}
    }

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
            contents: { parts },
            config: { responseModalities: [Modality.IMAGE], imageConfig: { aspectRatio, imageSize: "1K" } }
        });
        return response.candidates?.[0]?.content?.parts?.[0]?.inlineData ? `data:${response.candidates[0].content.parts[0].inlineData.mimeType};base64,${response.candidates[0].content.parts[0].inlineData.data}` : null;
    } catch (e) { console.error("Img Gen Error", e); return null; }
};

// --- NEW: HUMANIZER ENGINE ---
export const humanizeContent = async (text: string, brain: BrainData): Promise<string> => {
    const ai = getAiClient();
    if (!ai) return text;

    const prompt = `
        ACT AS: A ruthless editor who hates "AI Corporate Speak."
        TARGET: ${brain.identity.name} (Voice: ${brain.identity.voice.tone}).
        
        TASK: Rewrite this caption to sound HUMAN, RAW, and AUTHENTIC.
        
        INPUT: "${text}"
        
        RULES:
        1. KILL these words: "Delve", "Tapestry", "Unlock", "Elevate", "Game-changer", "In today's digital landscape".
        2. Remove excessive emojis. Max 1-2.
        3. Shorten sentences. Make it punchy.
        4. Lowercase is okay if it fits the vibe.
        5. Focus on "I" statements, not "We".
        
        OUTPUT: Just the rewritten text. No preamble.
    `;

    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: prompt,
        }));
        return response.text || text;
    } catch (e) { return text; }
};

// --- NEW: TREND PITCH (FOR NEWSROOM) ---
export const generateTrendPitch = async (trend: TrendCard, brain: BrainData): Promise<string> => {
    const ai = getAiClient();
    if (!ai) return "Hey, saw this trend.";
    const prompt = `ACT AS: ${brain.identity.name}. TONE: ${brain.identity.voice.tone}. SITUATION: Account Manager pitching trend "${trend.title}" to client. TASK: Write short DM. MUST INCLUDE: "Hey, I see you're online...", Mention trend, Suggest quick win. <280 chars.`;
    try {
        const r = await ai.models.generateContent({ model: getTextModel(), contents: prompt });
        return r.text || `Hey, I see you're online. ${trend.title} is trending. Let's use it.`;
    } catch { return "Trend alert."; }
};

// --- BEST PRACTICE BIOS ---
export const generateSocialBios = async (currentBio: string, industry: string = "Service"): Promise<{style: string, text: string}[]> => {
    const ai = getAiClient();
    if (!ai) return [];
    
    const prompt = `
        Rewrite this bio: "${currentBio}". Context: ${industry}.
        TASK: Create 3 "Best-in-Class" Instagram Bios using modern formatting:
        1. Line Breaks. 2. Emojis. 3. Credibility Statement. 4. CTA.
        
        STYLES: 1. Authority 2. Relatable 3. Minimalist
        
        OUTPUT JSON: [ { "style": "Authority", "text": "🚀 Helping X do Y\\n✨ Credibility\\n👇 CTA" } ]
    `;
    
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({ model: "gemini-2.5-flash", contents: prompt, config: { responseMimeType: "application/json" } }));
        return JSON.parse(jsonStr(response.text) || "[]");
    } catch (e) { return []; }
};

export const generateOnboardingCandidates = async (researchData: string, archetype: 'employee' | 'megafan'): Promise<{ candidates: AvatarCandidate[], brandContext: BrandContext, personaCV: PersonaCV, businessInfo: Partial<BusinessInfo> }> => {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key missing");
    
    const prompt = `
        Based on: ${researchData}
        Archetype: ${archetype}
        Generate 5 diverse candidates.
        
        CRITICAL: Define "Sitcom Elements" for content pillars:
        1. Prop (Vice like Coffee/RedBull). 2. Mascot (Truth Teller). 3. Villain (Friction).
        
        CRITICAL: Generate 5 "Available-Style" Instagram Handles (e.g. @MarketingWithMiso).
        
        OUTPUT JSON: { 
            "candidates": [{ 
                "id": "c1", "name": "Name", "sitcom_elements": { "prop": "...", "mascot": "...", "villain": "..." },
                "suggested_handles": ["@handle1", "@handle2"],
                "visualPrompt": "...", "traits": [], "voiceModes": [] 
            }],
            "brandContext": {}, "personaCV": {}, "businessInfo": {}
        }
    `;
    
    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({ model: getTextModel(), contents: prompt, config: { responseMimeType: "application/json" } }));
    const result = JSON.parse(jsonStr(response.text) || "{}");
    if (result.candidates) { 
        await Promise.all(result.candidates.map(async (c: any, index: number) => { 
            c.id = `candidate_${Date.now()}_${index}_${Math.random().toString(36).substr(2, 9)}`;
            const img = await generateGenAiImage(`${c.visualPrompt}. Wearing: ${c.uniform}`, true, false, null, '3:4'); 
            c.img = img; 
        })); 
    }
    return { candidates: result.candidates || [], brandContext: result.brandContext || {}, personaCV: result.personaCV || {}, businessInfo: result.businessInfo || {} };
};

export const generateTessWeek = async (brain: BrainData, focus: string, duration: SprintDuration, products: Product[], launchAssets: string[], scenario: ContentScenario = 'RELATABLE'): Promise<TessDayPlan[]> => {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key missing");

    let scenarioInstruction = "";
    switch (scenario) {
        case 'LAUNCH': scenarioInstruction = `STRATEGY: PRODUCT LAUNCH. Day 1: Teaser. Day 2: Problem. Day 3: Reveal. Day 4: Proof. Day 5: Usage. Day 6: FAQ. Day 7: Lifestyle.`; break;
        case 'NEWS': scenarioInstruction = `STRATEGY: INDUSTRY NEWS REACTION. Focus: "${focus}". Day 1: Breaking News. Day 2: Hot Take. Day 3: Impact. Day 4: Meme.`; break;
        case 'PROMO': scenarioInstruction = `STRATEGY: HARD PROMO. Goal: Sales. Day 1: Offer. Day 2: Scarcity. Day 3: Result. Day 4: Warning.`; break;
        case 'VLOG_WEEK': scenarioInstruction = `STRATEGY: DOCUMENTARY WEEK. High volume of VLOGS. Focus on reality and struggle.`; break;
        case 'EDUCATION': scenarioInstruction = `STRATEGY: EDUCATION. Goal: Authority. Day 1: How-To. Day 2: Myth. Day 3: Tools. Day 4: Mistake.`; break;
        default: scenarioInstruction = "STRATEGY: Balanced Mix of Pillars.";
    }

    const prompt = `
        Act as ${brain.identity.name}. Tone: ${brain.identity.voice.tone}.
        TASK: Create a ${duration}-Day Content Sprint.
        SCENARIO: ${scenario}
        FOCUS: "${focus}"
        ${scenarioInstruction}
        
        PILLARS: ${brain.strategy?.active_pillars.map(p => p.title).join(', ')}
        
        CRITICAL: For "Notes App", description MUST be: "Digital Screenshot of Apple Notes app. Yellow background. Text: [Insert Text]. NO HANDS."
        
        OUTPUT JSON: [{ "day": 1, "pillar": "...", "format": "Static", "hook": "...", "caption": "...", "visualPrompt": "...", "thumbnailHeadline": "...", "whyItWorks": "...", "assetType": "generate" }]
    `;

    const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({ model: getTextModel(), contents: prompt, config: { responseMimeType: "application/json" } }));
    return JSON.parse(jsonStr(response.text) || "[]");
};

// ... Keep existing exports
export const generateTessCard = async (brain: BrainData, pillar: string): Promise<TessDayPlan | null> => {
    const ai = getAiClient();
    if (!ai) return null;
    
    const prompt = `
        Act as ${brain.identity.name}.
        TASK: Generate ONE single social media post idea.
        STRATEGY PILLAR: "${pillar}".
        CONTEXT: The previous idea wasn't quite right. Try a different angle within this pillar.
        
        OUTPUT JSON:
        {
            "day": 1,
            "pillar": "${pillar}",
            "format": "Static",
            "hook": "New Hook Text",
            "caption": "New Caption...",
            "visualPrompt": "New detailed image prompt...",
            "thumbnailHeadline": "Thumbnail Text",
            "whyItWorks": "Reasoning",
            "assetType": "generate"
        }
    `;
    
    try {
        const response = await retryOperation<GenerateContentResponse>(() => ai.models.generateContent({
            model: getTextModel(),
            contents: prompt,
            config: { responseMimeType: "application/json" }
        }));
        return JSON.parse(jsonStr(response.text) || "null");
    } catch (e) {
        console.error("Card Gen Error", e);
        return null;
    }
};

export const performInitialResearch = async (url: string) => { const ai = getAiClient(); if(!ai) return ""; const r = await ai.models.generateContent({ model: "gemini-2.5-flash", contents: `Research ${url}`, config: { tools: [{ googleSearch: {} }] } }); return r.text || ""; };
export const generateStarterEnvironments = async (b: any, cb: any) => ({});
export const generateDeepPersona = async (c: any, v: any, b: any) => ({});
export const generatePersonaGallery = async (c: any, b: any, d: any, l: any) => [];
export const transcribeVideo = async (d: string, m: string) => null;
export const selectBestFrame = async (f: string[]) => [0];
export const generateHooksFromTranscript = async (t: string) => [{text:"Hook"}];
export const detectAgentIntent = async (t: string, i: boolean) => AgentTool.CHAT;
export const generateAgentChat = async (t: string, c: string, h: any[]): Promise<{text: string, sources: any[], image?: string}> => ({text:"...", sources:[]});
export const generateWeekPlan = async (t: string, i?: any) => ({posts:[]});
export const generateBrainUpdateProposal = async (t: string) => null;
export const generateTrendReport = async (q: string) => ({text:"", grounding:[]});
export const analyzeLocationImage = async (d: string, m: string) => "A nice room.";
export const analyzeVision = async (d: string, m: string, b?: any) => null;
export const generateVeoVideo = async (p: string, i?: any) => null;
export const generateVeoPrompt = async (d: string, m: string) => "";
export const generateCaptionFromImage = async (d: string, m: string, c?: string) => "";
export const generateSmartFill = async (posts: any[]) => [];
export const generateStoriesFromFeed = async (p: any[]) => [];
export const generateTrendScript = async (t: any) => null;
export const generateWeeklyFocusIdeas = async (b: any) => [];
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