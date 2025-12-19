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

export type Provider = 'gemini' | 'huggingface' | 'render';

// Helper: convert data URL to Blob
const dataURLToBlob = (dataURL: string) => {
  const parts = dataURL.split(',');
  const meta = parts[0];
  const base64 = parts[1];
  const mime = meta.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(base64);
  const len = binary.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = binary.charCodeAt(i);
  return new Blob([u8], { type: mime });
};

// Call the Render-hosted FastAPI scanning endpoint. The URL can be set via
// the RENDER_SCAN_URL env var or falls back to a placeholder you should replace.
export async function scanMailWithRenderFromDataUrl(dataUrl: string, renderUrl?: string) {
  const RENDER_SCAN_URL = renderUrl || (process as any)?.env?.RENDER_SCAN_URL || 'https://spindlier-diamond-remotely.ngrok-free.dev/scan';
  const blob = dataURLToBlob(dataUrl);
  const file = new File([blob], 'envelope.png', { type: blob.type });

  const formData = new FormData();
  formData.append('file', file);

  const headers: Record<string, string> = {
    // Required by ngrok to bypass the browser warning interstitial for programmatic requests
    'ngrok-skip-browser-warning': 'true'
  };

  const res = await fetch(RENDER_SCAN_URL, {
    method: 'POST',
    // Do not set Content-Type (browser will set multipart boundary automatically)
    headers,
    body: formData
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Render scan failed: ${res.status} ${res.statusText} ${txt}`);
  }
  const json = await res.json();
  return json; // expected { text: string, pin_code: string, ... }
}

export const extractMailData = async (
  base64Image: string,
  opts?: { provider?: Provider; model?: string; renderUrl?: string; retryAttempt?: number }
): Promise<MailData> => {
  const provider = opts?.provider || 'gemini';
  const model = opts?.model;
  const renderUrl = opts?.renderUrl;
  const retryAttempt = opts?.retryAttempt || 0;

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

  // Render FastAPI path: accept image POST and return extracted text / pin
  if (provider === 'render') {
    try {
      const json = await scanMailWithRenderFromDataUrl(`data:image/png;base64,${cleanBase64}`, renderUrl);
      // Map returned JSON into the MailData shape as best-effort
      const out: any = {
        recipient: json.recipient || '',
        address: json.text || json.address || '',
        pin_code: json.pin_code || json.pin || '',
        city: json.city || '',
        state: json.state || '',
        country: json.country || '',
        sorting_center_id: json.sorting_center_id || '',
        sorting_center_name: json.sorting_center_name || '',
        confidence: typeof json.confidence === 'number' ? Math.round(json.confidence) : 80,
        region: json.region || json.circle || json.region_name || ''
      };
      return finalize(out);
    } catch (err: any) {
      console.error('[aiService] Render scan failed', err);
      const em = err?.message || String(err);

      // If this is the first failure try a fallback: first Hugging Face (if available), then Gemini.
      if (retryAttempt === 0) {
        // Try Hugging Face if HF key is present
        if (process && (process as any).env && ((process as any).env.HF_API_KEY || (process as any).env.HF_KEY)) {
          console.warn('[aiService] Falling back to Hugging Face after Render failure');
          try {
            // Notify UI that we're attempting a fallback so the frontend can show a message
            if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
              (window as any).dispatchEvent(new CustomEvent('aiService:fallback', { detail: { from: 'render', to: 'huggingface' } }));
            }
          } catch (e) {
            /* ignore */
          }
          return extractMailData(base64Image, { provider: 'huggingface', model: model, retryAttempt: 1 });
        }

        // Otherwise try Gemini if available
        if (geminiClient) {
          console.warn('[aiService] Falling back to Gemini after Render failure');
          try {
            if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
              (window as any).dispatchEvent(new CustomEvent('aiService:fallback', { detail: { from: 'render', to: 'gemini' } }));
            }
          } catch (e) {
            /* ignore */
          }
          return extractMailData(base64Image, { provider: 'gemini', model: model, retryAttempt: 1 });
        }
      }

      // If we've already retried or no fallback available, surface a friendly error
      if (em && em.includes('404')) {
        throw new Error(`Render scan failed: 404 Not Found. Verify that the /scan endpoint exists at the provided URL (${renderUrl}). Response: ${em}`);
      }
      if (em && (em.includes('Failed to fetch') || em.includes('NetworkError') || em.includes('net::ERR') || em.includes('502') || em.includes('Bad Gateway'))) {
        throw new Error(`Network or CORS error when calling Render scan endpoint. Check the Render URL (${renderUrl}), ensure the service is running, and that CORS is enabled.`);
      }
      // otherwise rethrow original message
      throw new Error(`Render scan failed: ${em}`);
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
