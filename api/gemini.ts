import { GoogleGenAI } from "@google/genai";

// Simple serverless proxy for Gemini / Google GenAI.
// This stub attempts to call the Google Generative API using an API key stored
// in the environment variable `GOOGLE_API_KEY` (or `GEMINI_API_KEY`). If the key
// is not configured, it returns a helpful error so Vercel logs show the problem.

export default async function handler(req: any, res: any) {
  // Support a GET health-check so deployed apps can verify the route exists
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, message: 'Gemini proxy endpoint is deployed. POST to this route with { model, imageBase64 } to run inference.' });
    }

    if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

    const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
    if (!key) {
      return res.status(500).json({ error: 'Server not configured for Gemini. Set GOOGLE_API_KEY or GEMINI_API_KEY in Vercel project settings and redeploy.' });
    }

    try {
      const { model, imageBase64, prompt } = req.body || {};
      if (!model) return res.status(400).json({ error: 'Missing model in request body' });

      const ai = new GoogleGenAI({ apiKey: key });

      // Build the multimodal content: image inlineData (if provided) + text prompt
      const parts: any[] = [];
      if (imageBase64) {
        const cleanBase64 = String(imageBase64).replace(/^data:image\/(png|jpg|jpeg);base64,/, "");
        parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64 } });
      }

      const defaultPrompt = `Analyze this image of a mail envelope. Perform Optical Character Recognition (OCR) to extract the recipient and address details. Based on the extracted PIN/ZIP code and City, classify this mail item into a logical Sorting Center. Return the result purely as a valid JSON object with the following structure. Do not use markdown code blocks. { "recipient": "string", "address": "string", "pin_code": "string", "city": "string", "country": "string", "sorting_center_id": "string", "sorting_center_name": "string", "confidence": number } IMPORTANT: Return "confidence" as an integer between 0 and 100 (e.g., 95, not 0.95).`;

      parts.push({ text: prompt || defaultPrompt });

      const response: any = await ai.models.generateContent({
        model,
        contents: { parts },
        config: { temperature: 0.1 }
      });

      // Extract textual content from response (SDK returns `.text` when available)
      let text: string = response?.text || '';
      if (!text) {
        // Fallback: try to find text in output structure
        try {
          const out = response?.output || response?.outputs || [];
          if (Array.isArray(out) && out.length > 0) {
            const first = out[0];
            if (first?.content && Array.isArray(first.content)) {
              text = first.content.map((c: any) => c.text || c).join('\n');
            }
          }
        } catch (e) {
          // ignore
        }
      }

      let jsonText = String(text || '').trim();
      if (!jsonText) {
        return res.status(502).json({ error: 'Empty response from model', raw: response });
      }

      // Clean up markdown fences if present
      if (jsonText.includes('```json')) {
        jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '');
      } else if (jsonText.includes('```')) {
        jsonText = jsonText.replace(/```/g, '');
      }

      try {
        const parsed = JSON.parse(jsonText) as any;

        // Normalize confidence to 0-100 integer if present
        if (parsed && typeof parsed.confidence === 'number') {
          if (parsed.confidence > 0 && parsed.confidence <= 1) {
            parsed.confidence = Math.round(parsed.confidence * 100);
          } else {
            parsed.confidence = Math.round(parsed.confidence);
          }
        }

        return res.status(200).json({ ok: true, parsed, rawText: jsonText });
      } catch (parseErr: any) {
        console.error('[api/gemini] JSON parse failed', parseErr);
        return res.status(502).json({ error: 'Model returned non-JSON or malformed JSON', rawText: jsonText });
      }

    } catch (err: any) {
      console.error('[api/gemini] error', err);
      return res.status(500).json({ error: String(err) });
    }
}
