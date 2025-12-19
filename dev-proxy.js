#!/usr/bin/env node
import http from 'http';
import { GoogleGenAI } from '@google/genai';

const PORT = process.env.DEV_PROXY_PORT || 5174;
const KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || '';

const server = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/api/gemini') {
    let body = '';
    for await (const chunk of req) body += chunk;
    try {
      const json = body ? JSON.parse(body) : {};
      const { model, imageBase64, prompt } = json;
      if (!model) return res.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Missing model' }));
      if (!KEY) return res.writeHead(500, { 'Content-Type': 'application/json' }).end(JSON.stringify({ error: 'Missing GOOGLE_API_KEY' }));

      const ai = new GoogleGenAI({ apiKey: KEY });
      const parts = [];
      if (imageBase64) parts.push({ inlineData: { mimeType: 'image/png', data: String(imageBase64).replace(/^data:image\/(png|jpg|jpeg);base64,/, '') } });
      const defaultPrompt = prompt || `Analyze this image of a mail envelope. Perform OCR and return JSON { recipient, address, pin_code, city, country, sorting_center_id, sorting_center_name, confidence }`;
      parts.push({ text: defaultPrompt });

      const response = await ai.models.generateContent({ model, contents: { parts }, config: { temperature: 0.1 } });
      const text = response?.text || '';

      // Attempt to extract JSON from the model response (strip fences)
      let jsonText = String(text || '').trim();
      if (jsonText.includes('```json')) jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '');
      else if (jsonText.includes('```')) jsonText = jsonText.replace(/```/g, '');

      let parsed = null;
      try { parsed = JSON.parse(jsonText); } catch (e) { parsed = null; }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, parsed: parsed || null, rawText: text }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(err) }));
    }
    return;
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log(`Dev proxy listening on http://localhost:${PORT}`);
});
