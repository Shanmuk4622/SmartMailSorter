import { MailData } from './types';

// Client-side shim: call the server-side `/api/gemini` proxy instead of
// initializing `@google/genai` in the browser. This keeps API keys server-side.
export const extractMailData = async (base64Image: string): Promise<MailData> => {
  console.log('[GeminiService] forwarding image to /api/gemini');
  try {
    const resp = await fetch('/api/gemini', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gemini-3-flash-preview', imageBase64: base64Image })
    });

    const body = await resp.json();
    if (!resp.ok) {
      console.error('[GeminiService] server error', body);
      throw new Error(body?.error || 'Server-side Gemini proxy error');
    }

    if (body?.ok && body.parsed) {
      const data = body.parsed as MailData;
      // Ensure confidence normalization
      if (typeof data.confidence === 'number') {
        if (data.confidence > 0 && data.confidence <= 1) data.confidence = Math.round(data.confidence * 100);
        else data.confidence = Math.round(data.confidence);
      } else {
        data.confidence = 0;
      }
      return data;
    }

    throw new Error(body?.error || 'Unexpected response from Gemini proxy');
  } catch (err: any) {
    console.error('[GeminiService] extraction failed', err);
    throw err;
  }
};