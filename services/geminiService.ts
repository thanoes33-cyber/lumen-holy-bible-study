import { GoogleGenAI, Chat, GenerateContentResponse, Content, Modality } from "@google/genai";
import { DailyVerse } from "../types";

const SYSTEM_INSTRUCTION = `You are Lumen, a warm, wise, and empathetic Bible study assistant. 
Your goal is to help users understand the Bible, find comfort in scripture, and grow in their faith.

Key Responsibilities:
1. **Verse Lookup**: If a user inputs a specific Bible reference (e.g., "John 3:16", "Psalm 23", "1 Cor 13"), provide the full text of that passage immediately. Use the ESV or NIV translation. Format it clearly.
2. **Guidance**: When discussing topics, cite the book, chapter, and verse.
3. **Support**: If a user expresses distress, anxiety, or sadness, offer comforting verses and a gentle, prayerful tone.
4. **Current Events**: When asked about recent spiritual news, events, or happenings in the world, use your search tool to provide accurate and up-to-date information.

Guidelines:
- Always be respectful, non-denominational, and encouraging.
- Keep responses concise and easy to read on a mobile device.
- Do not be judgmental. Meet the user where they are in their spiritual journey.`;

let chatSession: Chat | null = null;
let currentChatModel: string = 'gemini-3-flash-preview';

const getAiClient = () => {
  return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// --- AUDIO UTILITIES (STRICT COMPLIANCE) ---

function decodeBase64(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeRawPcmToAudioBuffer(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number = 24000,
  numChannels: number = 1,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

// --- TTS SERVICE ---

export type GeminiVoiceName = 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';

export const generateTTS = async (text: string, voiceName: GeminiVoiceName = 'Zephyr'): Promise<AudioBuffer | null> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;

    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
    const audioData = decodeBase64(base64Audio);
    return await decodeRawPcmToAudioBuffer(audioData, audioCtx, 24000, 1);
  } catch (e) {
    console.error("Gemini TTS failed", e);
    return null;
  }
};

// --- CHAT SERVICES ---

export const getChatSession = (history?: Content[], isLite: boolean = false): Chat => {
  const targetModel = isLite ? 'gemini-flash-lite-latest' : 'gemini-3-flash-preview';
  
  if (!chatSession || currentChatModel !== targetModel) {
    const ai = getAiClient();
    currentChatModel = targetModel;
    chatSession = ai.chats.create({
      model: targetModel,
      history: history,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: [{ googleSearch: {} }],
      },
    });
  }
  return chatSession;
};

// --- Fix: Added getCharacterChatSession to support Bible Mentor chat feature ---
export const getCharacterChatSession = (name: string, instruction: string, history?: Content[]): Chat => {
  const ai = getAiClient();
  return ai.chats.create({
    model: 'gemini-3-flash-preview',
    history: history,
    config: {
      systemInstruction: instruction,
    },
  });
};

export const resetChatSession = (history?: Content[], isLite: boolean = false) => {
  chatSession = null;
  return getChatSession(history, isLite);
};

export const generateDailyVerse = async (isLite: boolean = false): Promise<DailyVerse> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: isLite ? 'gemini-flash-lite-latest' : 'gemini-3-flash-preview',
      contents: "Give me a short, encouraging Bible verse for today. Return ONLY the JSON object with keys 'text' and 'reference'. Do not use Markdown code blocks.",
      config: {
        responseMimeType: 'application/json',
      }
    });
    
    const text = response.text;
    if (!text) throw new Error("No text returned");
    return JSON.parse(text) as DailyVerse;
  } catch (e) {
    console.error("Failed to fetch verse", e);
    return {
      text: "For I know the plans I have for you, declares the Lord, plans for welfare and not for evil, to give you a future and a hope.",
      reference: "Jeremiah 29:11"
    };
  }
};

export const fetchBibleVerse = async (reference: string, isLite: boolean = false): Promise<DailyVerse | null> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: isLite ? 'gemini-flash-lite-latest' : 'gemini-3-flash-preview',
      contents: `Provide the Bible verse text for the reference: "${reference}". Use the NIV translation. Return ONLY a JSON object with keys 'text' and 'reference'.`,
      config: {
        responseMimeType: 'application/json',
      }
    });
    
    const text = response.text;
    if (!text) return null;
    return JSON.parse(text) as DailyVerse;
  } catch (e) {
    console.error("Failed to fetch specific verse", e);
    return null;
  }
};

export interface NewsItem {
  title: string;
  summary: string;
  uri: string;
}

export const fetchSpiritualNews = async (isLite: boolean = false): Promise<NewsItem[]> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: isLite ? 'gemini-flash-lite-latest' : 'gemini-3-flash-preview',
      contents: "Search for 3 recent and positive news stories or major events related to the Christian faith or humanitarian work worldwide from the last 7 days. Provide a brief summary for each. Return ONLY a JSON array of objects with keys 'title', 'summary', and 'uri'.",
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: 'application/json',
      }
    });
    
    const text = response.text;
    if (!text) return [];
    return JSON.parse(text) as NewsItem[];
  } catch (e) {
    console.error("Failed to fetch spiritual news", e);
    return [];
  }
};

export interface HoroscopeResult {
  text: string;
  sources: { uri: string; title: string }[];
}

export const generateHoroscope = async (sign: string, isLite: boolean = false): Promise<HoroscopeResult> => {
  try {
    const ai = getAiClient();
    const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const response = await ai.models.generateContent({
      model: isLite ? 'gemini-flash-lite-latest' : 'gemini-3-flash-preview',
      contents: `Find the daily horoscope for ${sign} for today, ${today}. Provide a warm, encouraging message of the day based on the current astrological influences. Summarize the key themes for love, career, and personal growth. Use search to find accurate current information.`,
      config: {
        tools: [{ googleSearch: {} }],
      }
    });

    const text = response.text;
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources = chunks
      .map((c: any) => c.web)
      .filter((w: any) => w)
      .map((w: any) => ({ uri: w.uri, title: w.title }));

    if (!text) throw new Error("No text returned from horoscope generation");
    return { text, sources };
  } catch (e) {
    console.error("Failed to generate horoscope", e);
    return {
      text: "The stars are quiet today. Focus on your inner peace and trust in your journey.",
      sources: []
    };
  }
};

export const generateDailyInspirationImage = async (): Promise<string | null> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: "A breathtaking, spiritually uplifting landscape at sunrise with cinematic lighting, peaceful atmosphere, high quality digital art. A sense of hope and divine presence." }]
      },
      config: {
        imageConfig: {
            aspectRatio: "16:9"
        }
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (e) {
    console.error("Failed to generate daily inspiration image", e);
    return null;
  }
};

export const generateBibleImage = async (prompt: string, size: '1K' | '2K' | '4K' = '1K'): Promise<string | null> => {
  try {
    const ai = getAiClient();
    const model = (size === '2K' || size === '4K') ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
    
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [{ text: `Create a high quality, respectful, biblical illustration for: ${prompt}. Artistic style: Realistic, cinematic lighting, detailed, oil painting style.` }]
      },
      config: {
        imageConfig: {
            aspectRatio: "1:1",
            ...(model === 'gemini-3-pro-image-preview' ? { imageSize: size } : {})
        }
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (e) {
    console.error("Failed to generate image", e);
    throw e;
  }
};

export const editBibleImage = async (imageDataUri: string, prompt: string, size: '1K' | '2K' | '4K' = '1K'): Promise<string | null> => {
  try {
    const match = imageDataUri.match(/^data:(.+);base64,(.+)$/);
    if (!match) throw new Error("Invalid image data");
    const mimeType = match[1];
    const data = match[2];

    const ai = getAiClient();
    const model = (size === '2K' || size === '4K') ? 'gemini-3-pro-image-preview' : 'gemini-2.5-flash-image';
    
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            inlineData: {
              data: data,
              mimeType: mimeType,
            },
          },
          {
            text: prompt,
          },
        ],
      },
      config: {
        imageConfig: {
            aspectRatio: "1:1",
            ...(model === 'gemini-3-pro-image-preview' ? { imageSize: size } : {})
        }
      }
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }
    return null;
  } catch (e) {
    console.error("Failed to edit image", e);
    throw e;
  }
};

export const enhancePrayerRequest = async (text: string, isLite: boolean = false): Promise<string> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: isLite ? 'gemini-flash-lite-latest' : 'gemini-3-flash-preview',
      contents: `Rewrite the following prayer request to be more articulate, humble, and spiritually grounded, while strictly preserving all specific details, names, and the original intent. Keep it concise. Request: "${text}"`,
    });
    return response.text || text;
  } catch (e) {
    console.error("Failed to enhance prayer", e);
    return text;
  }
};

export const generateJournalInsight = async (text: string): Promise<string> => {
  try {
    const ai = getAiClient();
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview', 
      contents: `Analyze this spiritual journal entry: "${text}". Provide a deep theological insight or a specific, highly relevant Bible verse connection to help the user grow. Keep the response brief, warm, and encouraging.`,
    });
    return response.text || "";
  } catch (e) {
    console.error("Failed to generate insight", e);
    return "";
  }
};