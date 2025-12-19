import { MailData } from './types';

// Helper to normalize a returned JSON blob into MailData
const finalize = (data: any): MailData => {
  const out: any = {
    recipient: data.recipient || data.name || '',
    address: data.address || data.text || '',
    pin_code: data.pin_code || data.zip || data.pin || '',
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

// Note: Gemini client is not initialized in the browser. Server-side proxy
// `/api/gemini` is used for Gemini requests to keep API keys secret.

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

  // If the configured URL points to our internal serverless proxy (starts with /api),
  // send a small JSON payload containing the data URL. This avoids multipart parsing
  // differences between browser -> Vercel and the external Render/ngrok service.
  if (RENDER_SCAN_URL.startsWith('/api') || RENDER_SCAN_URL.includes(window.location.hostname) && RENDER_SCAN_URL.endsWith('/api/scan')) {
    const res = await fetch(RENDER_SCAN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dataUrl })
    });
    const rawText = await res.text();
    console.log('[aiService] Render proxy (server) response status:', res.status, res.statusText);
    console.log('[aiService] Render proxy (server) raw response body:', rawText);
    try {
      if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
        (window as any).dispatchEvent(new CustomEvent('aiService:rawResponse', { detail: { raw: rawText, status: res.status, statusText: res.statusText } }));
      }
    } catch (e: any) { /* ignore */ }

    if (!res.ok) throw new Error(`Render proxy failed: ${res.status} ${res.statusText} ${rawText}`);
    try {
      const json = JSON.parse(rawText || '{}');
      return json;
    } catch (e: any) {
      throw new Error(`Render proxy returned invalid JSON: ${String(e?.message ?? e)} -- raw: ${rawText}`);
    }
  }

  // Otherwise send multipart/form-data directly to the external Render/ngrok URL
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
  // Log response details for debugging; read text first so we can print raw body
  const rawText = await res.text();
  // Use console.log so output appears even when devtools filter is set
  console.log('[aiService] Render scan response status:', res.status, res.statusText);
  console.log('[aiService] Render scan raw response body:', rawText);

  // Dispatch a DOM event with raw response so UI components can show it
  try {
    if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
      (window as any).dispatchEvent(new CustomEvent('aiService:rawResponse', { detail: { raw: rawText, status: res.status, statusText: res.statusText } }));
    }
  } catch (e: any) {
    /* ignore */
  }

  if (!res.ok) {
    throw new Error(`Render scan failed: ${res.status} ${res.statusText} ${rawText}`);
  }

  // Try to parse JSON; if the server returned plain text or malformed JSON this
  // will throw and be handled by callers. We log the parsed object too.
  try {
    const json = JSON.parse(rawText || '{}');
    console.log('[aiService] Render scan parsed JSON:', json);
    try {
      if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
        (window as any).dispatchEvent(new CustomEvent('aiService:rawResponse', { detail: { raw: rawText, json, status: res.status } }));
      }
    } catch (e: any) { /* ignore */ }
    return json; // expected shape documented below
    } catch (e: any) {
      console.error('[aiService] Failed to parse Render response as JSON:', e, rawText);
      try {
        if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
          (window as any).dispatchEvent(new CustomEvent('aiService:rawResponse', { detail: { raw: rawText, parseError: String(e), status: res.status } }));
        }
      } catch (ee: any) { /* ignore */ }
      throw new Error(`Render scan returned invalid JSON: ${String(e?.message ?? e)} -- raw: ${rawText}`);
    }
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
    } catch (e: any) {
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
          } catch (e: any) {
            /* ignore */
          }
          return extractMailData(base64Image, { provider: 'huggingface', model: model, retryAttempt: 1 });
        }

        // Otherwise try Gemini (via server-side proxy)
        try {
          console.warn('[aiService] Falling back to Gemini proxy after Render failure');
          if (typeof window !== 'undefined' && (window as any).dispatchEvent) {
            (window as any).dispatchEvent(new CustomEvent('aiService:fallback', { detail: { from: 'render', to: 'gemini' } }));
          }
        } catch (e: any) { /* ignore */ }
        return extractMailData(base64Image, { provider: 'gemini', model: model, retryAttempt: 1 });
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
  // For deployed apps we proxy Gemini calls to a serverless function so API keys
  // remain on the server. The serverless endpoint should be implemented as
  // `/api/gemini` and will call Google GenAI using a server-side key.
  try {
    console.log('[aiService] Routing request to server-side Gemini proxy', model || 'gemini-3-flash-preview');
    // Try standard relative serverless path first (works in deployed Vercel).
    // If that fails (404 or network), fall back to a local dev proxy on port 5174.
    let resp = null as any;
    try {
      resp = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: model || 'gemini-3-flash-preview', imageBase64: cleanBase64 })
      });
    } catch (e) {
      console.warn('[aiService] /api/gemini fetch failed, will attempt local dev proxy', String(e));
    }

    // If the first attempt returned a non-ok response or didn't run, try localhost dev proxy
    if (!resp || !resp.ok) {
      try {
        const localUrl = (typeof window !== 'undefined' && window.location.hostname === 'localhost') ? 'http://localhost:5174/api/gemini' : 'http://localhost:5174/api/gemini';
        console.log('[aiService] Trying dev proxy at', localUrl);
        resp = await fetch(localUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ model: model || 'gemini-3-flash-preview', imageBase64: cleanBase64 })
        });
      } catch (e) {
        console.warn('[aiService] Local dev proxy fetch failed', String(e));
      }
    }
    const text = resp ? await resp.text() : '';
    if (!resp.ok) {
      console.error('[aiService] Gemini proxy error:', resp.status, text);
      throw new Error(`Gemini proxy failed: ${resp.status} ${text}`);
    }

    // The proxy may return a JSON wrapper like { ok, parsed, rawText }
    // or may return the raw model text directly. Handle both.
    let parsed: any = null;
    try {
      const maybe = JSON.parse(text || '{}');
      if (maybe && (maybe.parsed || maybe.rawText)) {
        if (maybe.parsed) parsed = maybe.parsed;
        else {
          let jsonText = String(maybe.rawText || '').trim();
          if (jsonText.includes('```json')) jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '');
          else if (jsonText.includes('```')) jsonText = jsonText.replace(/```/g, '');
          parsed = JSON.parse(jsonText || '{}');
        }
      } else {
        // Not a wrapper, assume direct model output (possibly JSON or fenced JSON)
        let jsonText = String(text || '').trim();
        if (jsonText.includes('```json')) jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '');
        else if (jsonText.includes('```')) jsonText = jsonText.replace(/```/g, '');
        parsed = JSON.parse(jsonText || '{}');
      }
    } catch (e: any) {
      console.error('[aiService] Failed to parse Gemini response', e, 'raw:', text);
      throw new Error('Gemini proxy returned invalid JSON. See console for raw response.');
    }

    return finalize(parsed);
  } catch (error: any) {
    console.error('[aiService] Gemini extraction (proxy) failed:', error);
    const msg = String(error?.message || error || 'Unknown error');

    // If the proxy returned 404, provide clear guidance to check deployment
    if (msg.includes('Gemini proxy failed: 404') || msg.includes('404')) {
      throw new Error('Gemini proxy returned 404. Ensure /api/gemini is deployed on Vercel and reachable. Check Vercel Function logs for /api/gemini.');
    }

    throw error;
  }
};

export default { extractMailData };
