
import { getAppSettings } from "./brain";

const BASE_URL = "https://api.elevenlabs.io/v1";

interface Voice {
    voice_id: string;
    name: string;
    category: string;
    preview_url?: string;
}

const getElevenKey = () => {
    return getAppSettings().elevenLabsKey;
};

export const getVoices = async (): Promise<Voice[]> => {
    const apiKey = getElevenKey();
    if (!apiKey) throw new Error("ElevenLabs API Key is missing. Please add it in Settings.");

    try {
        const response = await fetch(`${BASE_URL}/voices`, {
            headers: {
                "xi-api-key": apiKey
            }
        });

        if (!response.ok) throw new Error("Failed to fetch voices");
        
        const data = await response.json();
        return data.voices.map((v: any) => ({
            voice_id: v.voice_id,
            name: v.name,
            category: v.category,
            preview_url: v.preview_url
        }));
    } catch (e) {
        console.error(e);
        return [];
    }
};

export const convertSpeechToSpeech = async (audioFile: File, voiceId: string, modelId: string = "eleven_english_sts_v2"): Promise<Blob> => {
    const apiKey = getElevenKey();
    if (!apiKey) throw new Error("ElevenLabs API Key is missing.");

    const formData = new FormData();
    formData.append("audio", audioFile);
    formData.append("model_id", modelId);
    
    // Voice settings can be tuned here
    formData.append("voice_settings", JSON.stringify({
        stability: 0.5,
        similarity_boost: 0.75,
        style: 0.0,
        use_speaker_boost: true
    }));

    const response = await fetch(`${BASE_URL}/speech-to-speech/${voiceId}`, {
        method: "POST",
        headers: {
            "xi-api-key": apiKey
        },
        body: formData
    });

    if (!response.ok) {
        const err = await response.json();
        throw new Error(err.detail?.message || "Speech-to-Speech conversion failed");
    }

    return await response.blob();
};
