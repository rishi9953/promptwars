
import { GoogleGenAI, Type } from "@google/genai";
import { DirectorConfig } from '../types';

let ai: GoogleGenAI | null = null;

const getAI = () => {
  if (!ai) {
    const apiKey = process.env.API_KEY || ''; // Fallback to empty string to prevent crash
    if (apiKey) {
      try {
        ai = new GoogleGenAI({ apiKey });
      } catch (e) {
        console.error("Failed to initialize AI", e);
      }
    }
  }
  return ai;
};

export const getDirectorUpdate = async (score: number, lives: number, timePlayed: number): Promise<DirectorConfig> => {
  try {
    const client = getAI();
    if (!client) throw new Error("AI Client not initialized (Missing API Key)");

    const response = await client.models.generateContent({
      model: "gemini-2.0-flash", // Updated to stable model if available, or keep preview
      contents: `Current game state: Score ${score}, Lives ${lives}, Seconds Played ${timePlayed}. 
      Decide the environmental parameters. Return a JSON object for a Snow Bros reimagining.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            lightingIntensity: { type: Type.NUMBER, description: 'Ambient light level 0.1 to 1.0' },
            fogDensity: { type: Type.NUMBER, description: 'Fog alpha 0.0 to 0.7' },
            snowRate: { type: Type.NUMBER, description: 'Particles per frame 1 to 10' },
            difficulty: { type: Type.NUMBER, description: 'AI aggression multiplier 1.0 to 2.5' },
            message: { type: Type.STRING, description: 'Short cinematic flavor text for the HUD' }
          },
          required: ['lightingIntensity', 'fogDensity', 'snowRate', 'difficulty', 'message']
        }
      }
    });

    if (response.text) {
      return JSON.parse(response.text.trim());
    }
    throw new Error("Empty response");
  } catch (error) {
    console.error("Director failed or AI unavailable:", error);
    return {
      lightingIntensity: 0.5,
      fogDensity: 0.2,
      snowRate: 2,
      difficulty: 1.0,
      message: "The storm rages on... (AI Offline)"
    };
  }
};

export const getCoachFeedback = async (reason: string, score: number): Promise<string> => {
  try {
    const client = getAI();
    if (!client) return "Even the strongest ice cracks... (AI Offline)";

    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `The player died because: ${reason}. Total score: ${score}. Give a 1-sentence cinematic, gritty Unreal Engine style coaching tip. Be encouraging but atmospheric.`,
    });
    const text = response.text;
    return text ? text.trim() : "Rise again.";
  } catch (error) {
    return "Even the strongest ice cracks under pressure. Rise again.";
  }
};
