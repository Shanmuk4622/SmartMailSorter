import { GoogleGenAI } from "@google/genai";
import { MailData } from './types';

// Initialize the client. API_KEY is expected to be in the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractMailData = async (base64Image: string): Promise<MailData> => {
  console.log("[GeminiService] Starting extraction process...");
  try {
    // Strip header if present to get pure base64
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

    console.log("[GeminiService] Sending request to Gemini-2.5-Flash-Image...");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // Fast, efficient for OCR tasks
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png', // Assuming PNG for canvas exports, but API handles others too
              data: cleanBase64
            }
          },
          {
            text: `Analyze this image of a mail envelope. Perform Optical Character Recognition (OCR) to extract the recipient and address details. 
            Based on the extracted PIN/ZIP code and City, classify this mail item into a logical Sorting Center.
            
            Return the result purely as a valid JSON object with the following structure. Do not use markdown code blocks.
            {
              "recipient": "string",
              "address": "string",
              "pin_code": "string",
              "city": "string",
              "country": "string",
              "sorting_center_id": "string",
              "sorting_center_name": "string",
              "confidence": number
            }
            
            IMPORTANT: Return "confidence" as an integer between 0 and 100 (e.g., 95, not 0.95).`
          }
        ]
      },
      config: {
        temperature: 0.1, // Lower temperature for more deterministic output
      }
    });

    console.log("[GeminiService] Response received.");
    let jsonText = response.text || "{}";
    console.debug("[GeminiService] Raw text response:", jsonText);
    
    // Clean up potential markdown formatting if the model includes it
    if (jsonText.includes("```json")) {
      jsonText = jsonText.replace(/```json/g, "").replace(/```/g, "");
    } else if (jsonText.includes("```")) {
      jsonText = jsonText.replace(/```/g, "");
    }

    try {
      const data = JSON.parse(jsonText.trim()) as MailData;
      
      // Normalization Logic: Ensure confidence is 0-100 Integer
      if (typeof data.confidence === 'number') {
        if (data.confidence <= 1 && data.confidence > 0) {
          // It sent a float (e.g. 0.95), convert to percentage
          data.confidence = Math.round(data.confidence * 100);
        } else {
          // It sent an integer or >1, just round it
          data.confidence = Math.round(data.confidence);
        }
      } else {
        // Fallback if missing
        data.confidence = 0;
      }

      console.log("[GeminiService] JSON parsed and normalized:", data);
      return data;
    } catch (parseError) {
      console.error("[GeminiService] JSON Parse Error:", parseError);
      console.error("[GeminiService] Failed JSON content:", jsonText);
      throw new Error("Invalid JSON response from AI model. Please retake the photo.");
    }

  } catch (error: any) {
    console.error("[GeminiService] Critical Extraction Error:", error);
    // Rethrow specific errors if possible, or pass the original error up
    throw error;
  }
};