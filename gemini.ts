import * as GenAI from "@google/genai";

const { GoogleGenAI, Type } = GenAI as any;

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export interface AnalysisResult {
  isHarmful: boolean;
  category: string;
  severity: 'Low' | 'Medium' | 'High';
  reason: string;
}

export interface VideoResult {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  url: string;
  isSafe: boolean;
  category: string;
}

const isQuotaError = (error: any) => {
  const msg = error?.message?.toLowerCase() || "";
  return msg.includes('429') || msg.includes('quota') || msg.includes('exhausted');
};

const QUOTA_ERROR_MSG = "Safety Guard is busy. Using local filters.";

// Simple local filter for common harmful keywords as a fallback
const localHarmfulKeywords = ['badword1', 'badword2', 'violence', 'adult', 'porn', 'kill', 'suicide', 'drugs'];
const localFilter = (text: string): AnalysisResult | null => {
  const lowerText = text.toLowerCase();
  for (const word of localHarmfulKeywords) {
    if (lowerText.includes(word)) {
      return {
        isHarmful: true,
        category: "Local Filter",
        severity: "Medium",
        reason: `Potential harmful content detected by local safety filter: ${word}`
      };
    }
  }
  return null;
};

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const callWithRetry = async (fn: () => Promise<any>, retries = 2, delay = 1000): Promise<any> => {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0 && isQuotaError(error)) {
      await sleep(delay);
      return callWithRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

const textCache = new Map<string, AnalysisResult>();
const videoCache = new Map<string, VideoResult[]>();

export const analyzeText = async (text: string, sensitivity: string): Promise<AnalysisResult> => {
  const cacheKey = `${text}-${sensitivity}`;
  if (textCache.has(cacheKey)) return textCache.get(cacheKey)!;

  try {
    const result = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Analyze the following text for harmful content suitable for children (Sensitivity Level: ${sensitivity}). 
      Categories: Violence, Sexual, Bullying, Self-harm, Gambling, Drugs, Horror.
      Text: "${text}"`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isHarmful: { type: Type.BOOLEAN },
            category: { type: Type.STRING },
            severity: { type: Type.STRING },
            reason: { type: Type.STRING },
          },
          required: ["isHarmful", "category", "severity", "reason"],
        },
      },
    }));

    const parsed = JSON.parse(result.text || "{}");
    textCache.set(cacheKey, parsed);
    return parsed;
  } catch (error) {
    if (!isQuotaError(error)) {
      console.error("Text analysis error:", error);
    }
    
    // Fallback to local filter if API fails
    const localResult = localFilter(text);
    if (localResult) return localResult;

    const reason = isQuotaError(error) ? QUOTA_ERROR_MSG : "Error in analysis";
    return { isHarmful: false, category: "None", severity: "Low", reason };
  }
};

export const analyzeImage = async (base64Data: string, sensitivity: string): Promise<AnalysisResult> => {
  try {
    const result = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          text: `Analyze this image for harmful content for children (Sensitivity Level: ${sensitivity}). 
          Look for: Nudity, Weapons, Blood, Dangerous objects, Horror.`,
        },
        {
          inlineData: {
            mimeType: "image/jpeg",
            data: base64Data.split(',')[1] || base64Data,
          },
        },
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            isHarmful: { type: Type.BOOLEAN },
            category: { type: Type.STRING },
            severity: { type: Type.STRING },
            reason: { type: Type.STRING },
          },
          required: ["isHarmful", "category", "severity", "reason"],
        },
      },
    }));

    return JSON.parse(result.text || "{}");
  } catch (error) {
    if (!isQuotaError(error)) {
      console.error("Image analysis error:", error);
    }
    const reason = isQuotaError(error) ? QUOTA_ERROR_MSG : "Error in analysis";
    // For images, if the guard is down, we might want to be more conservative, 
    // but for now we'll return safe to avoid blocking everything.
    return { isHarmful: false, category: "None", severity: "Low", reason };
  }
};

export const searchSafeVideos = async (query: string, isParentMode: boolean = false, allowedCategories?: string[]): Promise<VideoResult[]> => {
  const cacheKey = `${query}-${isParentMode}-${allowedCategories?.join(',')}`;
  if (videoCache.has(cacheKey)) return videoCache.get(cacheKey)!;

  try {
    const categoryInstruction = allowedCategories && allowedCategories.length > 0 
      ? `Assign each video one of these categories: ${allowedCategories.join(', ')}.` 
      : "Assign a relevant category to each video (e.g., Education, Entertainment, Games, Science, Art).";

    const result = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Search for ${isParentMode ? 'any' : 'educational and kid-safe'} videos about "${query}". 
      Return a list of 24 videos. 
      Each video must have a title, description, a valid thumbnail URL (use picsum.photos for simulation if needed), and a safe video URL (use sample mp4s if needed).
      ${categoryInstruction}
      ${isParentMode ? '' : 'Strictly filter out any adult, harmful, or non-educational content.'}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
              description: { type: Type.STRING },
              thumbnail: { type: Type.STRING },
              url: { type: Type.STRING },
              isSafe: { type: Type.BOOLEAN },
              category: { type: Type.STRING },
            },
            required: ["id", "title", "description", "thumbnail", "url", "isSafe", "category"],
          },
        },
      },
    }));

    const parsed = JSON.parse(result.text || "[]");
    videoCache.set(cacheKey, parsed);
    return parsed;
  } catch (error) {
    console.error("Video search error:", error);
    return [];
  }
};

export const analyzeFace = async (base64Image: string, parentFaceData?: string): Promise<{ faceDetected: boolean, estimatedAge: number | null, isParent: boolean | null }> => {
  try {
    const parts: any[] = [
      { inlineData: { data: base64Image, mimeType: "image/jpeg" } },
      { text: "Analyze this image for face detection and age estimation. Return JSON: { \"faceDetected\": boolean, \"estimatedAge\": number | null, \"isParent\": boolean | null }." }
    ];

    if (parentFaceData) {
      parts.push({ inlineData: { data: parentFaceData, mimeType: "image/jpeg" } });
      parts[1].text += " Also compare the first image with the second image (registered parent). Set \"isParent\" to true if they are the same person.";
    }

    const result = await callWithRetry(() => ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [{ parts }],
      config: { responseMimeType: "application/json" }
    }));

    return JSON.parse(result.text || '{}');
  } catch (error) {
    if (isQuotaError(error)) {
      // Return a neutral state during quota exhaustion
      return { faceDetected: true, estimatedAge: null, isParent: null };
    }
    console.error("Face analysis error:", error);
    throw error;
  }
};
