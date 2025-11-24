import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const askNetworkAdvisor = async (prompt: string, contextData: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: `You are an expert Senior Network Engineer and IPAM administrator. 
      Answer the user's question regarding IP address management, subnetting, or network architecture.
      
      Current System Context (JSON Summary):
      ${contextData}
      
      User Question: ${prompt}
      
      Provide a concise, professional, and actionable answer. formatting with Markdown.`,
    });
    return response.text || "No response generated.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Maaf, saya tidak dapat memproses permintaan Anda saat ini. Pastikan kunci API valid.";
  }
};

export const suggestSubnetPlan = async (requirement: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `User requirement: "${requirement}". Suggest a CIDR subnetting plan.`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    cidr: { type: Type.STRING },
                    description: { type: Type.STRING }
                },
                required: ["name", "cidr", "description"]
            }
        }
    });
    
    return response.text || "{}";
  } catch (error) {
    console.error(error);
    return "{}";
  }
};