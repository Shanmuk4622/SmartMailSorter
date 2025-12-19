import { GoogleGenAI } from "@google/genai";
import { MailData } from './types';

// Initialize Gemini client if API key is present
const geminiKey = (process as any)?.env?.API_KEY || (process as any)?.env?.GEMINI_API_KEY;
let geminiClient: any = null;
if (geminiKey) {
  try {
    geminiClient = new GoogleGenAI({ apiKey: geminiKey });
  } catch (e) {
    console.warn('[aiService] Could not initialize Gemini client', e);
  }
}

// Helper to normalize and validate MailData
const finalize = (data: any): MailData => {
  if (!data) throw new Error('Empty response data');
  // Ensure fields exist
  const out: any = {
    recipient: data.recipient || '',
    address: data.address || '',
    pin_code: data.pin_code || data.zip || '',
    city: data.city || '',
    state: data.state || '',
    country: data.country || '',
    sorting_center_id: data.sorting_center_id || '',
    sorting_center_name: data.sorting_center_name || '',
    confidence: 0
  };

  if (typeof data.confidence === 'number') {
    if (data.confidence <= 1 && data.confidence > 0) out.confidence = Math.round(data.confidence * 100);
    else out.confidence = Math.round(data.confidence);
  }

  return out as MailData;
};

export type Provider = 'gemini' | 'huggingface';

export const extractMailData = async (
  base64Image: string,
  opts?: { provider?: Provider; model?: string }
): Promise<MailData> => {
  const provider = opts?.provider || 'gemini';
  const model = opts?.model;

  // Clean base64 image data
  const cleanBase64 = base64Image.replace(/^data:image\/(png|jpg|jpeg);base64,/, "");

  if (provider === 'huggingface') {
    // For dev, we call the local proxied path `/api/hf/...` and let the dev
    // middleware inject the `HF_API_KEY`. Do NOT include the key in client
    // requests to avoid exposing it in the browser.
    const modelId = model || 'meta-llama/Llama-3.2-11B-Vision-Instruct';
    const endpoint = `/api/hf/v1/chat/completions`;

    console.log('[aiService] Sending request to Hugging Face Router v1 chat', modelId);

    const prompt = `Analyze this image of a mail envelope. Perform Optical Character Recognition (OCR) to extract the recipient and address details. Based on the extracted PIN/ZIP code and City, classify this mail item into a logical Sorting Center. Return the result purely as a valid JSON object with exactly the following keys: recipient, address, pin_code, city, country, sorting_center_id, sorting_center_name, confidence. Confidence should be an integer 0-100.`;

    // For vision-capable models we include the image as a data URI inside the user message.
    const userContent = `Image: data:image/png;base64,${cleanBase64}\n\n${prompt}`;

    const payload = {
      model: modelId,
      messages: [
        { role: 'user', content: userContent }
      ]
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const text = await res.text();
    if (!res.ok) {
      console.error('[aiService] Hugging Face error response:', text);
      if (res.status === 404) {
        throw new Error(`Hugging Face model not found or inaccessible. Ensure the model '${modelId}' exists and your HF_API_KEY has access (accept license on https://huggingface.co/${encodeURIComponent(modelId)}).`);
      }
      throw new Error(`Hugging Face inference failed: ${res.status} ${res.statusText}`);
    }

    const json = await res.json();
    if (!res.ok) {
      console.error('[aiService] Hugging Face error response JSON:', json);
      if (res.status === 404) {
        throw new Error(`Hugging Face model not found or inaccessible. Ensure the model '${modelId}' exists and your HF_API_KEY has access (accept license on https://huggingface.co/${encodeURIComponent(modelId)}).`);
      }
      throw new Error(`Hugging Face inference failed: ${res.status} ${res.statusText}`);
    }

    // Router v1 chat returns choices[].message.content similar to OpenAI
    try {
      const content = json.choices?.[0]?.message?.content || json.choices?.[0]?.message || json.output || json;
      let maybeText = typeof content === 'string' ? content : JSON.stringify(content);
      if (maybeText.includes('```json')) maybeText = maybeText.replace(/```json/g, '').replace(/```/g, '');
      else if (maybeText.includes('```')) maybeText = maybeText.replace(/```/g, '');
      const parsed = JSON.parse(maybeText.trim());
      return finalize(parsed);
    } catch (e) {
      console.error('[aiService] Failed to parse HF chat response as JSON:', e, json);
      throw new Error('Invalid JSON response from Hugging Face model.');
    }
  }

  // Default: Gemini
  if (!geminiClient) throw new Error('Gemini client not initialized. Set API_KEY in env.');

  try {
    console.log('[aiService] Sending request to Gemini model', model || 'gemini-3-flash-preview');
    const response = await geminiClient.models.generateContent({
      model: model || 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: 'image/png',
              data: cleanBase64
            }
          },
          {
            text: `Analyze this image of a mail envelope. Perform Optical Character Recognition (OCR) to extract recipient and address details. Based on the extracted PIN/ZIP code and City, classify this mail item into a logical Sorting Center. Return the result purely as a valid JSON object with the following structure. Do not use markdown code blocks. { "recipient": "string", "address": "string", "pin_code": "string", "city": "string", "country": "string", "sorting_center_id": "string", "sorting_center_name": "string", "confidence": number } IMPORTANT: Return "confidence" as an integer between 0 and 100.`
          }
        ]
      },
      config: { temperature: 0.1 }
    });

    let jsonText = response.text || '{}';
    if (jsonText.includes('```json')) jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '');
    else if (jsonText.includes('```')) jsonText = jsonText.replace(/```/g, '');

    const parsed = JSON.parse(jsonText.trim());
    return finalize(parsed);
  } catch (error: any) {
    console.error('[aiService] Gemini extraction failed:', error);
    throw error;
  }
};

export default { extractMailData };
