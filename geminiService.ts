import { GoogleGenAI, Type, Schema } from "@google/genai";
import { MailData } from './types';

// Initialize the client. API_KEY is expected to be in the environment.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    recipient: { type: Type.STRING, description: "Name of the recipient found on the envelope." },
    address: { type: Type.STRING, description: "Full extraction of the address lines." },
    pin_code: { type: Type.STRING, description: "The extracted postal code, ZIP code, or PIN code." },
    city: { type: Type.STRING, description: "City inferred from address or PIN." },
    country: { type: Type.STRING, description: "Country inferred from address or PIN." },
    sorting_center_id: { type: Type.STRING, description: "A hypothetical ID for the sorting center (e.g., SC-NY-01)." },
    sorting_center_name: { type: Type.STRING, description: "A plausible name for the sorting center based on location." },
    confidence: { type: Type.NUMBER, description: "Confidence score of the extraction from 0 to 100." }
  },
  required: ["recipient", "address", "pin_code", "city", "country", "sorting_center_id", "confidence"],
};

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
            Return the result in JSON format.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2, // Low temperature for factual extraction
      }
    });

    const jsonText = response.text || "{}";
    const data = JSON.parse(jsonText) as MailData;
    return data;

  } catch (error) {
    console.error("Gemini Extraction Error:", error);
    throw new Error("Failed to process image with AI service.");
  }
};