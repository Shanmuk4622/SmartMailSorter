import { GoogleGenAI } from "@google/genai";
import { MailData } from './types';

// Initialize the client. API_KEY is expected to be in the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const extractMailData = async (base64Image: string): Promise<MailData> => {
  try {
    // Strip header if present to get pure base64
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

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
            }`
          }
        ]
      },
      config: {
        temperature: 0.2, // Low temperature for factual extraction
      }
    });

    let jsonText = response.text || "{}";
    
    // Clean up potential markdown formatting if the model includes it
    if (jsonText.includes("```json")) {
      jsonText = jsonText.replace(/```json/g, "").replace(/```/g, "");
    } else if (jsonText.includes("```")) {
      jsonText = jsonText.replace(/```/g, "");
    }

    const data = JSON.parse(jsonText.trim()) as MailData;
    return data;

  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw new Error("Failed to process image with AI service.");
  }
};