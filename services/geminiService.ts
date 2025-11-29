

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
const getPreferredTextModel = () => {
    // Explicitly using Gemini 3 Pro Preview as requested for all prompts
    return 'gemini-3-pro-preview';
};

// --- PROMPT CONSTRUCTOR ---
export const constructImageGenPrompt = (visualPrompt: string, engine: string, isEnvironment: boolean, brain: BrainData, hasReference: boolean = false): string => {
    const isExplicit360 = visualPrompt.toLowerCase().includes('360') || visualPrompt.toLowerCase().includes('panorama');
    
    // Check if the prompt mentions a known 360 location from the brain
    const known360Location = Object.values(brain.locations || {}).find(loc => 
        loc.is360 && visualPrompt.toLowerCase().includes(loc.name.toLowerCase())
    );

    // SANITIZER: Remove digital/sci-fi trigger words that cause "screens"
    let cleanVisualPrompt = visualPrompt.replace(/hologram|digital overlay|hud|screen|interface|cyber|futuristic|glowing data|floating|virtual|circuit|soft lighting|studio lighting/gi, "");
    
    // If it's a person, remove "screen" to prevent floating screens, but allow "holding phone" if contextually needed (handled by 'candid' prompt)
    if (!isEnvironment) {
        cleanVisualPrompt = cleanVisualPrompt.replace(/screen/gi, "");
    }

    // --- LOGIC: 360 ROOM ADAPTATION ---
    // If we are generating a PERSON (!isEnvironment) but the context is a 360 room (known360Location),
    // we must instruct the AI to "Unwarp" or "Frame" a standard shot.
    if (!isEnvironment && known360Location) {
        cleanVisualPrompt += `
        
        [ENVIRONMENT CONTEXT: 360 ROOM SOURCE]
        The setting '${known360Location.name}' is a 360-degree panoramic environment.
        INSTRUCTION: Generate a STANDARD, RECTILINEAR (Flat) photograph taken FROM INSIDE this room.
        - Do NOT generate a sphere or 360 projection.
        - Do NOT warp the edges.
        - Frame the subject (Tess) at the specific spot mentioned (e.g. "${cleanVisualPrompt.substring(0, 50)}...").
        - The background should be a natural, flat slice of the 360 room description.
        `;
    }

    // --- SEEDREAM (STABLE DIFFUSION STYLE) ---
    if (engine === 'seedream') {
        let tags = [
            "iphone photography", 
            "authentic", 
            "raw photo",
            "high quality", 
            "everyday life",
            "imperfect",
            "social media style"
        ];
        
        if (isEnvironment) {
             tags.push("interior architecture", "lived-in", "no humans", "photorealistic interior", "natural light", "organized clutter", "lifestyle photography");
             // Only force 360 output if it IS an environment shot AND explicitly requested/flagged
             if (isExplicit360 || known360Location) {
                 tags.push("(equirectangular:1.4)", "360 panorama", "vr360", "full room view", "seamless");
             }
        } else {
            tags.push(
                "portrait",
                "candid", 
                "diverse", // Added for diversity in legacy engine
                "clean smooth skin", 
                "healthy complexion",
                "natural skin texture",
                "well-groomed",
                "natural look",
                "normal clothes",
                "no sci-fi",
                "no holograms",
                "no screens",
                "no digital overlays",
                "no heavy filters",
                "no makeup",
                "no airbrushing",
                "no acne",
                "no bumpy texture"
            );
        }
        
        const cleanedPrompt = cleanVisualPrompt.replace(/\./g, ',').replace(/Visual Prompt:\s*/i, '');
        tags.push(cleanedPrompt);
        
        return tags.join(', ');
    }

    // --- NANO PRO (GEMINI PRO IMAGE) - HIGH REALISM ---
    if (engine === 'nano-pro' || engine === 'nano-fast') {
        // "Nano Banana" Style - Highly Realistic, No Digital Artifacts
        const safeBio = brain.identity?.bio || "A social media manager.";
        
        if (isEnvironment) {
             const shouldUse360Format = isExplicit360 || (known360Location && isEnvironment);
             return `
                ROLE: Professional Architectural Photographer & Interior Stylist.
                TASK: Generate a single, stunning, hyper-realistic photo of a room.
                STYLE: "Architectural Digest" meets "Real Life".
                
                BIO CONTEXT FOR PROPS: "${safeBio}"
                - IF PARENT: Add specific kid clutter (e.g. a singular colorful plastic dinosaur on the floor, a drawing on the fridge).
                - IF GEN Z: Tech clutter (cables, power bank), skincare bottle, iced coffee cup.
                - IF PROFESSIONAL: Moleskine notebook, nice pen, laptop (closed or natural).
                
                CRITICAL VISUAL RULES:
                - NO SCREENS FLOATING IN AIR. NO HOLOGRAMS.
                - NO DIGITAL OVERLAYS.
                - STRAIGHT VERTICAL LINES (Architectural photography rule).
                - ORGANIZED CHAOS: Looks lived-in, not staged. A jacket on a chair. A bag on the floor.
                - NEVER MESSY/DIRTY. Just "active".
                ${shouldUse360Format ? '- FORMAT: 360-degree equirectangular panorama projection.' : ''}

                SCENE:
                ${cleanVisualPrompt}
             `;
        } else {
             return `
                ROLE: Candid Lifestyle Photographer.
                TASK: Generate an authentic, real-life photo of a person.
                STYLE: "Shot on iPhone", clean aesthetic, natural light, high quality.
                
                SUBJECT:
                A real human. 20-40 years old. 
                Style: Smart Casual / Real world aesthetic. Looks put together and well-groomed.
                
                DIVERSITY POLICY: 
                Unless the user has provided a specific reference image or the prompt explicitly describes a specific person (like "Tess"), you MUST prioritize diversity. 
                - Represent a wide range of ethnicities (Black, Asian, Hispanic, Middle Eastern, White, etc.).
                - Represent different genders if not specified.
                - Avoid defaulting to generic stock photo looks. Make them look unique and authentic.
                
                ${hasReference ? "IMPORTANT: Use the provided reference image to determine the subject's facial features and hair. Maintain character consistency (Ethnicity, Gender, Hair)." : ""}
                
                STRICT NEGATIVE PROMPTS (DO NOT INCLUDE):
                - NO STUDIO LIGHTING. NO EDITORIAL. NO FASHION SHOOT.
                - NO LAB COATS. NO STETHOSCOPES.
                - NO RELIGIOUS SYMBOLS.
                - NO SCI-FI, NO CYBORGS.
                - NO FLOATING SCREENS.
                - NO OVER-SHARPENING (Avoid 'burnt', 'gritty', or 'dirty' look).
                - NO PLASTIC SKIN. NO AIRBRUSHING. NO BLURRY FACES.
                - NO ACNE. NO ROSACEA. NO ROUGH SKIN. NO BUMPY TEXTURE. NO EXCESSIVE PORES. NO GRITTY TEXTURE.
                
                CRITICAL VISUAL DETAILS:
                - LIGHTING: Soft, diffused natural window light. Flattering. No harsh shadows.
                - SKIN: Natural, healthy, clean skin texture. Smooth but not plastic. Looks well-rested and hydrated. Natural pores are okay, but NO bumps or irritation.
                - MAKEUP: Clean, fresh, 'no-makeup' look.
                - CAMERA: Smartphone focal length (28mm). High resolution.
                - POSE: Candid, looking away, checking phone, laughing.
                
                SCENE DESCRIPTION:
                ${cleanVisualPrompt}
             `;
        }
    }

    return cleanVisualPrompt;
};

// --- KIE.AI / SEEDREAM INTEGRATION ---
const generateKieImage = async (prompt: string): Promise<string | null> => {
    const kieKey = getKieKey();
    if (!kieKey) return null;
    
    try {
        let response = await fetch("https://api.kie.ai/v1/images/generations", {
            method: "POST",
            headers: { "Authorization": `Bearer ${kieKey}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model: "bytedance/seedream-v4-text-to-image", prompt: prompt, n: 1, size: "1024x1024", response_format: "b64_json" })
        });
        if (!response.ok) return null;
        const data = await response.json();
        return data.data?.[0]?.b64_json ? `data:image/png;base64,${data.data[0].b64_json}` : null;
    } catch (e) { return null; }
};

// --- CORE GENERATION FUNCTIONS ---

export const generateGenAiImage = async (
    visualPrompt: string, 
    useStrictTessStyle: boolean = true, 
    isEnvironment: boolean = false, 
    referenceImage: string | null = null,
    aspectRatio: '1:1' | '3:4' | '4:3' | '9:16' | '16:9' = '9:16'
): Promise<string | null> => {
    const settings = getAppSettings();
    const brain = getBrain();
    const hasRef = !!referenceImage;
    let finalPrompt = constructImageGenPrompt(visualPrompt, settings.imageEngine, isEnvironment, brain, hasRef);
    
    if (settings.imageEngine === 'seedream') {
        const kieImage = await generateKieImage(finalPrompt);
        if (kieImage) return kieImage;
    }

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
    
    // Always use gemini-3-pro-image-preview unless explicitly using kie/seedream
    let modelName = 'gemini-3-pro-image-preview';

    let retries = 3;
    while (retries > 0) {
        try {
            const response = await ai.models.generateContent({
                model: modelName,
                contents: { parts },
                config: { 
                    responseModalities: [Modality.IMAGE],
                    imageConfig: {
                        aspectRatio: aspectRatio,
                        imageSize: "1K"
                    }
                }
            });
            const part = response.candidates?.[0]?.content?.parts?.[0];
            if (part && part.inlineData) return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
            return null;
        } catch (error: any) { 
            // Fallback to flash-image if pro not found (though 3-pro should be available)
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

// --- VIDEO ANALYSIS TOOLS ---

export const transcribeVideo = async (base64Data: string, mimeType: string): Promise<VideoTranscript | null> => {
    const ai = getAiClient();
    if (!ai) return null;

    const prompt = `
        TASK: Transcribe the audio from this video.
        
        OUTPUT JSON:
        {
            "title": "A catchy title for this clip",
            "transcript": [
                { "timestamp": "00:00", "speaker": "Speaker 1", "dialogue": "..." },
                { "timestamp": "00:05", "speaker": "Speaker 2", "dialogue": "..." }
            ]
        }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: {
                parts: [
                    { inlineData: { data: base64Data, mimeType: mimeType } },
                    { text: prompt }
                ]
            },
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(jsonStr(response.text) || "null");
    } catch (e) {
        console.error("Transcription Failed", e);
        return { title: "Error Transcribing", transcript: [] };
    }
};

export const selectBestFrame = async (framesBase64: string[]): Promise<number[]> => {
    const ai = getAiClient();
    if (!ai) return [0];

    const prompt = `
        TASK: Analyze these 3 video frames.
        Identify the single most engaging frame to use as a YouTube/Instagram thumbnail.
        Look for: Clear facial expressions, action, or high visual interest.
        
        OUTPUT JSON:
        [ index_of_best_frame ] 
        (e.g. [0] or [1] or [2])
    `;

    const parts: any[] = framesBase64.map(f => ({
        inlineData: {
            data: f.split(',')[1],
            mimeType: 'image/jpeg'
        }
    }));
    parts.push({ text: prompt });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: { parts },
            config: { responseMimeType: "application/json" }
        });
        const result = JSON.parse(jsonStr(response.text) || "[0]");
        return result;
    } catch (e) {
        console.error("Frame Selection Failed", e);
        return [0];
    }
};

export const generateHooksFromTranscript = async (transcriptText: string): Promise<{text: string}[]> => {
    const ai = getAiClient();
    if (!ai) return [];
    
    const brain = getBrain();
    const safeTone = brain.identity?.voice?.tone || "Casual and engaging";

    const prompt = `
        TASK: Read this video transcript and generate 5 viral text overlays (hooks) for a thumbnail.
        Keep them short, punchy, and click-worthy.
        Tone: ${safeTone}.
        
        TRANSCRIPT:
        "${transcriptText.substring(0, 2000)}..."
        
        OUTPUT JSON:
        [
            { "text": "Stop doing this 🛑" },
            { "text": "The secret to X..." }
        ]
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(jsonStr(response.text) || "[]");
    } catch (e) {
        return [{ text: "Watch this video" }];
    }
};

// --- AGENT CAPABILITIES ---

export const detectAgentIntent = async (text: string, hasImage: boolean): Promise<AgentTool> => {
    const ai = getAiClient();
    if (!ai) return AgentTool.CHAT;

    const prompt = `
        Classify the user's intent into one of these categories:
        - TOOL_TRENDS: Wants to find viral trends, news, or audio.
        - TOOL_VISION: Provided an image and wants analysis/captions/prompts. (Only if hasImage is true).
        - TOOL_PLANNER: Wants to generate a content schedule, plan posts, or draft content.
        - TOOL_BRAIN_UPDATE: Wants to change settings, personality, bio, tone, or brand info.
        - TOOL_CHAT: General conversation, strategy questions, advice, or asking to generate a single image/picture.

        User Input: "${text}"
        Has Image Attached: ${hasImage}

        Output just the category name.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt
        });
        const result = response.text?.trim().toUpperCase();
        if (result?.includes('TREND')) return AgentTool.TRENDS;
        if (result?.includes('VISION')) return AgentTool.VISION;
        if (result?.includes('PLAN')) return AgentTool.PLANNER;
        if (result?.includes('UPDATE')) return AgentTool.BRAIN_UPDATE;
        return AgentTool.CHAT;
    } catch (e) {
        return AgentTool.CHAT;
    }
};

export const generateAgentChat = async (text: string, context: string, history: any[]): Promise<any> => {
    const ai = getAiClient();
    if (!ai) return { text: "I'm offline (No API Key).", sources: [] };
    
    const brain = getBrain();
    const safeName = brain.identity?.name || "Tess";
    const safeRole = brain.identity?.role || "Assistant";
    const safeTone = brain.identity?.voice?.tone || "Helpful";
    const safeBio = brain.identity?.bio || "";
    
    const systemInstruction = `
        You are ${safeName}, the "Mega Brain" of social media. 
        You possess the combined wisdom of Ava, Jun, and world-class marketing experts. 
        You have deep, specific knowledge of our business history and goals.

        YOUR BRAND IDENTITY:
        Name: ${safeName}
        Role: ${safeRole}
        Tone: ${safeTone}
        Bio: ${safeBio}
        
        YOUR CAPABILITIES:
        1. Search & Trend Analysis: You have full access to the web to identify real-time trends. Use Google Search when asked about current events.
        2. Visual Intelligence: If users upload images, analyze them for POVs, captions, and prompts.
        3. Content Execution: Don't just brainstorm; propose finished assets.
        4. Unrestricted Assistance: Answer any content strategy question.
        
        TOOL USE:
        If the user asks to generate an image, you MUST use the function 'generate_image'.

        CONTEXT:
        ${context}
        
        BRAND CONTEXT:
        ${brain.brand?.raw_knowledge?.substring(0, 1000) || ""}
    `;

    const tools = [{
        functionDeclarations: [
            {
                name: 'generate_image',
                description: 'Generates an AI image based on a prompt.',
                parameters: {
                    type: Type.OBJECT,
                    properties: {
                        prompt: { type: Type.STRING, description: 'The visual description of the image to generate.' }
                    },
                    required: ['prompt']
                }
            }
        ]
    }];

    try {
        const chat = ai.chats.create({
            model: "gemini-3-pro-preview",
            config: {
                systemInstruction: systemInstruction,
                tools: tools
            },
            history: history.map(h => ({
                role: h.role === 'agent' ? 'model' : 'user',
                parts: [{ text: h.text }]
            }))
        });

        const response = await chat.sendMessage({ message: text });
        
        // Handle Function Call for Image Gen
        const functionCall = response.functionCalls?.[0];
        if (functionCall && functionCall.name === 'generate_image') {
            const prompt = (functionCall.args as any).prompt;
            
            // Get reference image from brain to ensure it looks like "Tess"
            const refImage = brain.identity?.referenceImages?.[0] || brain.identity?.avatar || null;
            
            // Use 9:16 by default for chat generated images as they are likely for social
            const imageUrl = await generateGenAiImage(prompt, true, false, refImage, '9:16');
            
            await chat.sendMessage({
                message: [{
                    functionResponse: {
                        name: functionCall.name,
                        response: { result: "Image generated successfully." }
                    }
                }]
            });

            return {
                text: "I've generated that image for you.",
                image: imageUrl, // Return image to UI
                sources: []
            };
        }
        
        return {
            text: response.text,
            sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
        };
    } catch (e) {
        console.error(e);
        return { text: "I'm having trouble connecting to my brain right now.", sources: [] };
    }
};

export const generateWeekPlan = async (userPrompt: string, image?: any): Promise<{ posts: WeeklyPostPlan[] }> => {
    const ai = getAiClient();
    if (!ai) return { posts: [] };
    const brain = getBrain();
    const safeTone = brain.identity?.voice?.tone || "Professional";

    const parts: any[] = [];
    if (image) parts.push({ inlineData: { data: image.data, mimeType: image.mimeType } });
    
    const systemPrompt = `
        You are the Content Execution Engine.
        Generate a list of social media posts based on the user's request.
        
        CONTEXT:
        Brand: ${brain.brand?.name || "My Brand"}
        Tone: ${safeTone}
        
        OUTPUT JSON:
        [
            {
                "category": "Educational" | "Viral" | "Sales" | "Lifestyle",
                "format": "VIDEO" | "IMAGE",
                "caption": "Full caption with hooks",
                "hashtags": ["#tag1"],
                "visualPrompt": "Detailed visual description for AI generation",
                "location": "Office" | "Studio" | "Street"
            }
        ]
    `;
    
    parts.push({ text: systemPrompt });
    parts.push({ text: `REQUEST: ${userPrompt}` });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: { parts },
            config: { responseMimeType: "application/json" }
        });
        const posts = JSON.parse(jsonStr(response.text) || "[]");
        return { posts };
    } catch (e) { return { posts: [] }; }
};

export const generateBrainUpdateProposal = async (text: string): Promise<BrainUpdateProposal | null> => {
    const ai = getAiClient();
    if (!ai) return null;
    const brain = getBrain();

    const prompt = `
        The user wants to update the AI Persona configuration.
        Analyze the request and propose a JSON patch.
        
        CURRENT STATE SAMPLE:
        Name: ${brain.identity?.name}
        Bio: ${brain.identity?.bio}
        Tone: ${brain.identity?.voice?.tone}
        Values: ${brain.brand?.values}
        
        REQUEST: "${text}"
        
        OUTPUT JSON:
        {
            "fieldPath": "identity.bio" | "identity.voice.tone" | "brand.values" etc,
            "currentValue": "Old value...",
            "newValue": "New value...",
            "reasoning": "Why this change was made"
        }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(jsonStr(response.text) || "null");
    } catch (e) { return null; }
};

export const generateTrendReport = async (query: string) => {
    const ai = getAiClient();
    if (!ai) return { text: "Error: No API Key", grounding: [] };

    const prompt = `
        TASK: Search for real-time social media trends regarding: "${query}".
        Use Google Search to find current data.
        
        OUTPUT FORMAT:
        First, write a 2-3 sentence summary of the current landscape.
        Then, for each specific trend found, output a line starting with "TREND_CARD:".
        
        Format:
        TREND_CARD: Title | Platform/Origin | Vibe | Strategy
        
        Example:
        The beauty industry is shifting towards "skin cycling"...
        TREND_CARD: Skin Cycling | TikTok | Educational | Create a 4-day routine infographic.
        TREND_CARD: Mob Wife Aesthetic | Instagram | Bold/Glam | Use faux fur and bold makeup transitions.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: { tools: [{ googleSearch: {} }] }
        });
        return { 
            text: response.text || "", 
            grounding: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
        };
    } catch (e) {
        return { text: "I couldn't find any trends right now.", grounding: [] };
    }
};

export const analyzeLocationImage = async (base64Data: string, mimeType: string): Promise<string | null> => {
    const ai = getAiClient();
    if (!ai) return null;

    const prompt = `
        TASK: Analyze this image and write a highly detailed visual description prompt for an AI image generator (Stable Diffusion / Midjourney style).
        
        FOCUS ON:
        - Architectural details (walls, floor, ceiling).
        - Furniture style, placement, and materials.
        - Lighting (direction, quality, color).
        - Key objects and "clutter" that give it personality.
        - Color palette and atmosphere.
        
        OUTPUT:
        A single, dense paragraph of descriptive text. Do not use intro/outro. Start directly with the description.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: {
                parts: [
                    { inlineData: { data: base64Data, mimeType: mimeType } },
                    { text: prompt }
                ]
            }
        });
        return response.text || null;
    } catch (e) {
        console.error("Location Analysis Failed", e);
        return null;
    }
};

export const generateVeoVideo = async (prompt: string, imageContext?: { mimeType: string, data: string }): Promise<string | null> => {
    const ai = getAiClient();
    if (!ai) return null;

    try {
        // Veo 3.1 Fast - Generation
        let operation;
        
        if (imageContext) {
            // Image-to-Video
            operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: prompt,
                image: {
                    imageBytes: imageContext.data,
                    mimeType: imageContext.mimeType
                },
                config: {
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: '9:16' // Vertical for social
                }
            });
        } else {
            // Text-to-Video
            operation = await ai.models.generateVideos({
                model: 'veo-3.1-fast-generate-preview',
                prompt: prompt,
                config: {
                    numberOfVideos: 1,
                    resolution: '720p',
                    aspectRatio: '9:16'
                }
            });
        }

        // Poll for completion
        while (!operation.done) {
            await wait(10000); // Wait 10s
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
        if (!downloadLink) return null;

        // Fetch the bytes
        const apiKey = getApiKey();
        const response = await fetch(`${downloadLink}&key=${apiKey}`);
        const blob = await response.blob();
        return URL.createObjectURL(blob);

    } catch (e) {
        console.error("Veo Generation Failed", e);
        return null;
    }
};

export const generateSmartFill = async (currentPosts: FeedPost[]) => {
    const ai = getAiClient();
    if (!ai) return [];
    const brain = getBrain();
    const safeTone = brain.identity?.voice?.tone || "Engaging";

    // Analyze gaps in the feed
    const filledCount = currentPosts.filter(p => p.imageUrl || p.caption).length;
    const needed = 9 - filledCount;
    if (needed <= 0) return [];

    const prompt = `
        You are the Content Strategist.
        We need ${needed} more posts to complete the 9-grid feed.
        
        CURRENT FEED CONTEXT:
        ${currentPosts.map((p, i) => p.caption ? `Post ${i+1}: ${p.notes}` : `Post ${i+1}: [EMPTY]`).join('\n')}
        
        BRAND TONE: ${safeTone}
        
        TASK: Generate ${needed} posts to fill the empty slots. Balance the grid (mix of Educational, Viral, Sales).
        
        OUTPUT JSON:
        [
            {
                "category": "Educational",
                "caption": "Caption text...",
                "hashtags": ["#tag"],
                "visualPrompt": "Visual description for image gen"
            }
        ]
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(jsonStr(response.text) || "[]");
    } catch (e) { return []; }
};

export const generateStoriesFromFeed = async (posts: FeedPost[]): Promise<StoryItem[]> => {
    const ai = getAiClient();
    if (!ai) return [];
    
    // Filter only valid posts
    const validPosts = posts.filter(p => p.caption && (p.imageUrl || p.videoUrl)).slice(0, 3);
    if (validPosts.length === 0) return [];

    const prompt = `
        Convert these feed posts into Instagram Story concepts.
        For each post, write a short, punchy overlay text for a Story that drives traffic to the post.
        
        POSTS:
        ${validPosts.map((p, i) => `Post ${i}: ${p.caption.substring(0, 100)}...`).join('\n')}
        
        OUTPUT JSON:
        [
            {
                "id": "story_1",
                "caption": "Overlay text...",
                "type": "story"
            }
        ]
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        const stories = JSON.parse(jsonStr(response.text) || "[]");
        
        // Map back to images
        return stories.map((s: any, i: number) => ({
            ...s,
            imageUrl: validPosts[i]?.imageUrl || null,
            relatedPostId: validPosts[i]?.id
        }));
    } catch (e) { return []; }
};

export const generateTrendScript = async (trend: any) => {
    const ai = getAiClient();
    if (!ai) return null;
    const brain = getBrain();
    const safeName = brain.identity?.name || "Me";
    const safeRole = brain.identity?.role || "Creator";
    const safeBio = brain.identity?.bio || "";
    const safeTone = brain.identity?.voice?.tone || "Casual";

    const prompt = `
        You are ${safeName}, the ${safeRole} for ${brain.brand?.name || "Brand"}.
        
        Your Goal: Hijack this viral trend to talk about your niche (${brain.brand?.industry || "Industry"}).
        
        TREND INFO:
        - Title: "${trend.title}"
        - Original Vibe: "${trend.vibe}"
        - Strategy: "${trend.strategy}"
        
        YOUR BRAND PERSONALITY:
        - Bio: "${safeBio}"
        - Tone: "${safeTone}"
        - Key Offers: ${(brain.brand?.key_offers || []).join(', ')}
        
        TASK: Write a video script adapting this trend specifically for ${brain.brand?.name}.
        It must feel authentic to your persona. 
        If the trend is a specific audio or format, describe how YOU would use it in your specific work environment (e.g. ${Object.values(brain.locations || {})[0]?.name || 'Office'}).
        
        OUTPUT JSON:
        {
            "visual_cue": "Specific visual action (e.g. 'Sitting at desk at Pret...', 'Holding a coffee...')",
            "hook_text": "The text overlay on screen (Must relate to ${brain.brand?.industry})",
            "caption": "The caption (Use your specific tone of voice)",
            "why_it_works": "Why this specific adaptation fits your persona"
        }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(jsonStr(response.text) || "null");
    } catch (e) { 
        console.error("Script Gen Failed", e);
        return null; 
    }
};

export const generateTrainingExamples = async (brain: BrainData): Promise<VoiceExample[]> => {
    const ai = getAiClient();
    if (!ai) return [];

    const prompt = `
        You are an expert Voice Designer.
        TASK: Create 3 "Voice Training Examples" for this persona to define their unique style.
        
        PERSONA IDENTITY:
        Name: ${brain.identity?.name || "Tess"}
        Role: ${brain.identity?.role || "SMM"}
        Bio: ${brain.identity?.bio || ""}
        Tone: ${brain.identity?.voice?.tone || ""}
        Keywords: ${(brain.identity?.voice?.keywords || []).join(', ')}
        Forbidden Words: ${(brain.identity?.voice?.keywords || []).join(', ')}
        
        INSTRUCTIONS:
        For each example, take a "Boring/Corporate/Generic" input (like a standard marketing announcement or a polite email), and rewrite it into the PERSONA'S VOICE.
        The rewrite must show, not tell, the personality (sarcasm, chaos, brevity, emojis).
        
        OUTPUT JSON ARRAY:
        [
            {
                "input": "We are excited to announce our new booking feature.",
                "output": "Finally. You can now book without talking to me. Link in bio. 💀",
                "notes": "Uses brevity and deadpan humor."
            }
        ]
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
        
        const raw = JSON.parse(jsonStr(response.text) || "[]");
        return raw.map((item: any, i: number) => ({
            id: `TRAIN_${Date.now()}_${i}`,
            input: item.input,
            output: item.output,
            notes: item.notes
        }));
    } catch (e) {
        console.error(e);
        return [];
    }
};

export const generateSocialBios = async (currentBio: string) => {
    const ai = getAiClient();
    if (!ai) return [];
    
    const prompt = `
      Act as a Neuromarketing Expert. Rewrite this social media bio.
      
      User's Current Bio: "${currentBio}"
      
      GOAL: Target the "Lizard Brain". High status, punchy, scannable.
      
      STRICT RULES:
      1. Max 150 Characters.
      2. Use line breaks so it stacks vertically.
      3. Use exactly 3 emojis.
      4. Keep the specific facts (Location, Job, Cat's name, Coffee preference).
      5. Tone: Witty, slightly chaotic but successful.
      
      Output Format: JSON Array with 3 options.
      Example:
      [
        { "style": "Punchy", "text": "Socials @ NoSho 📱\\nFueled by Oat Whites ☕️\\nMiso the cat is CEO 🐈" },
        { "style": "Witty", "text": "..." }
      ]
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: { parts: [{ text: prompt }] },
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(jsonStr(response.text) || "[]");
    } catch (e) { return []; }
};

export const generateTessWeek = async (brain: BrainData, focus: string, duration: SprintDuration, products: Product[], launchAssets: string[]): Promise<TessDayPlan[]> => {
    const ai = getAiClient();
    if (!ai) return [];

    const productContext = products.length > 0 ? `FEATURED PRODUCTS: ${products.map(p => `${p.name} (${p.description})`).join(', ')}` : "No specific products.";
    const launchContext = launchAssets.length > 0 ? `Visual Assets provided for launch context.` : "";
    const safeTone = brain.identity?.voice?.tone || "Engaging";

    const prompt = `
        ROLE: Social Media Strategist for ${brain.brand?.name}.
        PERSONA: ${brain.identity?.name}. Tone: ${safeTone}.
        FOCUS: "${focus}"
        DURATION: ${duration} Days.
        
        ${productContext}
        ${launchContext}

        TASK: Generate a ${duration}-day content calendar.
        
        OUTPUT JSON ARRAY:
        [
            {
                "day": 1,
                "pillar": "Workday Chaos", 
                "format": "Reel (9-12s)",
                "hook": "Text on screen...",
                "caption": "Caption...",
                "visualPrompt": "AI Image prompt...",
                "thumbnailHeadline": "Headline...",
                "whyItWorks": "Strategy note...",
                "assetType": "generate", 
                "veoPrompt": "Prompt for video generation...",
                "script": "Spoken script...",
                "textOverlay": "Text on image...",
                "nanoModel": "gemini-3-pro-image-preview"
            }
        ]
    `;

    const parts: any[] = [];
    parts.push({ text: prompt });

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: { parts },
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(jsonStr(response.text) || "[]");
    } catch (e) {
        console.error(e);
        return [];
    }
};

export const generateTessCard = async (brain: BrainData, pillar: string): Promise<TessDayPlan | null> => {
     const ai = getAiClient();
    if (!ai) return null;

    const prompt = `
        Generate a single social media post idea for ${brain.brand?.name} (${brain.identity?.name}).
        PILLAR: ${pillar}
        TONE: ${brain.identity?.voice?.tone}
        
        OUTPUT JSON (TessDayPlan format).
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
         return JSON.parse(jsonStr(response.text) || "null");
    } catch (e) { return null; }
};

export const generateWeeklyFocusIdeas = async (brain: BrainData): Promise<string[]> => {
     const ai = getAiClient();
    if (!ai) return [];

    const prompt = `
        Generate 5 creative content sprint themes for ${brain.brand?.name}.
        Context: ${brain.brand?.raw_knowledge?.substring(0, 500) || ""}
        OUTPUT JSON: ["Theme 1", "Theme 2"...]
    `;
     try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: prompt,
            config: { responseMimeType: "application/json" }
        });
         return JSON.parse(jsonStr(response.text) || "[]");
    } catch (e) { return []; }
};

export const analyzeVision = async (base64Data: string, mimeType: string, brain?: BrainData): Promise<VisionAnalysisResult | null> => {
    const ai = getAiClient();
    if (!ai) return null;
    
    // Fallback if brain not provided
    const tone = brain?.identity?.voice?.tone || "Professional but engaging";

    const prompt = `
        Analyze this image for social media potential.
        Tone: ${tone}
        
        OUTPUT JSON:
        {
            "critique": "Constructive feedback on the image aesthetic.",
            "caption": "A viral caption for Instagram/TikTok.",
            "hashtags": ["#tag1", "#tag2"],
            "povText": "A short 'POV:' text overlay for the image.",
            "veoPrompt": "A prompt to animate this image using Veo.",
            "imagePrompt": "A prompt to recreate this image using AI."
        }
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: {
                parts: [
                    { inlineData: { data: base64Data, mimeType: mimeType } },
                    { text: prompt }
                ]
            },
            config: { responseMimeType: "application/json" }
        });
        return JSON.parse(jsonStr(response.text) || "null");
    } catch (e) { return null; }
};

export const generateCaptionFromImage = async (base64Data: string, mimeType: string, context: string = ""): Promise<string> => {
    const ai = getAiClient();
    if (!ai) return "";
    
    const brain = getBrain();

    const prompt = `
        Write a caption for this image.
        Context: ${context}
        Persona: ${brain.identity?.name || "Creator"}
        Tone: ${brain.identity?.voice?.tone || "Engaging"}
        
        Output ONLY the caption text.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: {
                parts: [
                    { inlineData: { data: base64Data, mimeType: mimeType } },
                    { text: prompt }
                ]
            }
        });
        return response.text?.trim() || "";
    } catch (e) { return ""; }
};

export const generateVeoPrompt = async (base64Data: string, mimeType: string): Promise<string> => {
    const ai = getAiClient();
    if (!ai) return "";

    const prompt = `
        Write a prompt for Google Veo (Video Generation AI) to animate this image.
        Describe movement, camera angle, and lighting.
        Keep it under 60 words.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: "gemini-3-pro-preview",
            contents: {
                parts: [
                    { inlineData: { data: base64Data, mimeType: mimeType } },
                    { text: prompt }
                ]
            }
        });
        return response.text?.trim() || "";
    } catch (e) { return ""; }
};

export const performInitialResearch = async (url: string): Promise<string> => {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key missing");

    const researchPrompt = `
        Research this brand URL: ${url}
        Find: Brand Name, Industry, What they sell, Target Audience, Tone of Voice, Key Offers.
        Look for visual style and aesthetics.
    `;

    const researchResponse = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: researchPrompt,
        config: { tools: [{ googleSearch: {} }] }
    });
    
    return researchResponse.text || "No data found.";
};

export const generateOnboardingCandidates = async (researchData: string, archetype: 'employee' | 'megafan'): Promise<{
    candidates: AvatarCandidate[],
    brandContext: BrandContext,
    personaCV: PersonaCV,
    businessInfo: Partial<BusinessInfo>
}> => {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key missing");

    const archetypeInstruction = archetype === 'employee' 
        ? "ARCHETYPE: INTERNAL EMPLOYEE. 'The Insider'. Perspective: 'We'. The goal is to build trust through expertise and behind-the-scenes access. STRICTLY NO FOUNDERS. This is a staff member (e.g. Social Manager, Stylist, Barista, Assistant)."
        : "ARCHETYPE: SUPER FAN / CREATOR. 'The Customer'. Perspective: 'I'. The goal is to share an authentic obsession with the product/service.";

    const synthesisPrompt = `
        Based on this research:
        ${researchData}
        
        ${archetypeInstruction}
        
        Generate a Brand Scan Report with 5 DISTINCT CANDIDATES.
        
        CRITICAL RULES:
        1. **DIVERSITY**: The 5 candidates MUST be diverse in gender, ethnicity, and style.
           - Candidate 1: Specific distinct ethnicity/gender.
           - Candidate 2: Different ethnicity/gender.
           - Candidate 3: Different ethnicity/gender.
           - Candidate 4: Different ethnicity/gender.
           - Candidate 5: Different ethnicity/gender.
        2. **FULL NAMES**: Generate a unique, trustworthy **FULL NAME** (First + Last Name) for each candidate.
           - Examples: 'Sarah Jenkins', 'Marcus Chen', 'Priya Patel', 'Elena Rodriguez', 'David Okafor'.
           - The name MUST match their ethnicity and vibe.
        3. **LIFE SNAPSHOT**: Use real influencer research to assign a realistic Location, specific Pet (with name), and unusual Hobby.
        4. **DETAILS**: Generate Pronouns and Birthday (Month/Day).
        5. **JOB ROLE**: 
           - If Employee: Give them a specific staff role (e.g. 'Head Stylist', 'Junior Marketer', 'Barista'). NO FOUNDERS.
           - If Super Fan: Give them a specific unrelated Day Job (e.g. 'Nurse', 'Accountant', 'Student', 'Graphic Designer').
        6. **UNIFORM/STYLE**: 
           - If Employee: Describe their work uniform or dress code (e.g. 'Black branded apron', 'Smart casual suit').
           - If Super Fan: Describe their personal style (e.g. 'Vintage boho', 'Streetwear').
        7. **VOICE MODES**: For EACH candidate, generate 3 specific 'Voice Modes' (Calm, Balanced, Chaotic).
        
        OUTPUT JSON:
        {
            "businessInfo": { "name": "...", "industry": "...", "tagline": "...", "what_we_sell": "...", "target_audience": "...", "key_offers": ["..."], "competitors": ["..."], "tone_of_voice": "...", "values": "..." },
            "brandContext": { "category": "...", "region": "...", "visualSignals": ["..."], "offerTypes": ["..."], "priceTier": "mid", "competitorRefs": [] },
            "personaCV": { "audienceArchetype": "...", "fears": ["..."], "desires": ["..."], "priceSensitivity": "mid", "visualTolerance": { "clutter": "mid", "motion": "high", "faceTime": "mid" }, "callToActionRules": ["..."], "bannedAngles": ["..."] },
            "candidates": [
                {
                    "id": "c1",
                    "name": "Full Name",
                    "pronouns": "She/Her",
                    "birthday": "April 12",
                    "label": "Creative Descriptor",
                    "tagline": "...",
                    "location": "City, Country",
                    "pet": "Pet Type & Name",
                    "hobby": "Specific Unusual Hobby",
                    "day_job": "Specific Role",
                    "uniform": "Description of clothing",
                    "traits": ["..."],
                    "visualPrompt": "A 28 year old [Ethnicity] [Gender] wearing [uniform]...",
                    "skills": ["..."],
                    "mission": "Default mission statement...",
                    "chaosLevel": 40,
                    "sarcasmLevel": 30,
                    "archetype": "${archetype}",
                    "voiceModes": [
                        { "title": "Calm", "mission": "...", "voiceDescription": "...", "samplePost": "...", "chaosLevel": 10, "sarcasmLevel": 10 },
                        { "title": "Balanced", "mission": "...", "voiceDescription": "...", "samplePost": "...", "chaosLevel": 50, "sarcasmLevel": 40 },
                        { "title": "Chaotic", "mission": "...", "voiceDescription": "...", "samplePost": "...", "chaosLevel": 90, "sarcasmLevel": 80 }
                    ]
                }
            ]
        }
    `;

    const synthesisResponse = await ai.models.generateContent({
        model: "gemini-3-pro-preview",
        contents: synthesisPrompt,
        config: { responseMimeType: "application/json" }
    });
    
    const result = JSON.parse(jsonStr(synthesisResponse.text) || "{}");
    
    // Generate Candidate Images (Parallel)
    if (result.candidates) {
        await Promise.all(result.candidates.map(async (c: any) => {
            const enhancedVisualPrompt = `${c.visualPrompt}. Wearing: ${c.uniform}.`;
            const img = await generateGenAiImage(enhancedVisualPrompt, true, false, null, '3:4');
            c.img = img;
        }));
    }

    return {
        candidates: result.candidates || [],
        brandContext: result.brandContext || {},
        personaCV: result.personaCV || {},
        businessInfo: result.businessInfo || {}
    };
};

export const performBrandScan = async (url: string) => {
    const research = await performInitialResearch(url);
    return generateOnboardingCandidates(research, 'employee');
};

export const generateStarterEnvironments = async (brain: BrainData, onProgress: () => void): Promise<Record<string, LocationData>> => {
    const ai = getAiClient();
    if (!ai) return {};

    const prompt = `
        Based on this brand: ${brain.brand?.name || "Brand"} (${brain.brand?.industry || "Service"}).
        Generate 4 key physical environments (Locations) where content should be filmed.
        
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
             const visualPrompt = `MASTER SHOT: ${l.name}. ${l.visualData}. Style: High-end architectural photography.`;
             const img = await generateGenAiImage(visualPrompt, false, true, null, '16:9');
             l.imageUrl = img;
             l.imageUrls = img ? [img] : [];
             locsMap[l.id] = l;
        }));

        return locsMap;
    } catch (e) { return {}; }
};

// --- DEEP PERSONA GENERATION (UPDATED) ---

export const generateDeepPersona = async (candidate: AvatarCandidate, voiceMode: VoiceMode, businessInfo: Partial<BusinessInfo>): Promise<any> => {
    const ai = getAiClient();
    if (!ai) throw new Error("API Key missing");

    const backstoryInstruction = candidate.archetype === 'employee'
        ? "They applied to work here. They have a specific role at the company. Talk about their interview or first day."
        : "They NEVER applied to work here. They are a SUPER FAN customer who discovered the brand and became obsessed. Their 'Day Job' is totally unrelated to the brand.";

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
        
        CRITICAL: Generate 4-5 expert CONTENT PILLARS that this person would actually post about, based on the company needs and modern social strategy.
        Also generate specific HUMOR PILLARS.
        
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
            const img = await generateGenAiImage(shot.prompt, true, false, referenceImage, '3:4');
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
