import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';
import { GoogleGenAI } from '@google/genai';

export default defineConfig(({ mode }) => {
	const env = loadEnv(mode, process.cwd(), '');
	const HF_KEY = env.HF_API_KEY || env.HF_KEY || '';

	const hfProxyPlugin = (): Plugin => ({
		name: 'vite:hf-proxy',
		configureServer(server) {
				server.middlewares.use('/api/hf', async (req: any, res: any) => {
				try {
					const targetPath = (req.url || '').replace(/^\/api\/hf/, '');
					// Decode the incoming path (frontend will URL-encode model IDs)
					// so we forward a clean path to the Hugging Face Router.
					const decodedPath = decodeURIComponent(targetPath);
					// Use the Hugging Face Router endpoint for model invocations.
					const target = `https://router.huggingface.co${decodedPath}`;

					// Collect request body
					const chunks: Uint8Array[] = [];
					for await (const chunk of req) chunks.push(chunk);
					const body = chunks.length ? Buffer.concat(chunks) : undefined;

					// Build headers and inject HF key from local env (dev only)
					const headers: Record<string, string> = {};
					if (req.headers['content-type']) headers['content-type'] = String(req.headers['content-type']);
					// Use the standard 'Authorization' header name (capitalized).
					if (HF_KEY) headers['Authorization'] = `Bearer ${HF_KEY}`;

					const fetchRes = await fetch(target, {
						method: req.method,
						headers,
						body
					});

					res.statusCode = fetchRes.status;
					fetchRes.headers.forEach((value, key) => {
						try { res.setHeader(key, value); } catch (e) {}
					});
					res.setHeader('Access-Control-Allow-Origin', '*');

					const arrayBuffer = await fetchRes.arrayBuffer();
					res.end(Buffer.from(arrayBuffer));
				} catch (err) {
					console.error('[vite:hf-proxy] proxy error', err);
					try { res.statusCode = 502; res.end('Proxy error'); } catch (e) {}
				}
			});

				// Proxy for external scan endpoint to avoid CORS during local development.
				server.middlewares.use('/api/scan', async (req: any, res: any) => {
					try {
						const target = env.RENDER_SCAN_URL || 'https://spindlier-diamond-remotely.ngrok-free.dev/scan';
						console.log(`[vite:scan-proxy] ${req.method} ${req.url} -> ${target}`);
						// Collect request body
						const chunks: Uint8Array[] = [];
						for await (const chunk of req) chunks.push(chunk);
						const body = chunks.length ? Buffer.concat(chunks) : undefined;

						const headers: Record<string, string> = {};
						if (req.headers['content-type']) headers['content-type'] = String(req.headers['content-type']);

						const fetchRes = await fetch(target, {
							method: req.method,
							headers,
							body
						});

						res.statusCode = fetchRes.status;
						console.log(`[vite:scan-proxy] response ${fetchRes.status} ${fetchRes.statusText} for ${req.url}`);
						fetchRes.headers.forEach((value, key) => {
							try { res.setHeader(key, value); } catch (e) {}
						});
						// ensure browser can receive the response
						res.setHeader('Access-Control-Allow-Origin', '*');

						const arrayBuffer = await fetchRes.arrayBuffer();
						res.end(Buffer.from(arrayBuffer));
					} catch (err) {
						console.error('[vite:scan-proxy] proxy error', err);
						try { res.statusCode = 502; res.end('Scan proxy error'); } catch (e) {}
					}
				});

				// Dev-only Gemini proxy: call Google GenAI locally using GOOGLE_API_KEY
				server.middlewares.use('/api/gemini', async (req: any, res: any) => {
					try {
						const key = env.GOOGLE_API_KEY || env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
						if (!key) return res.statusCode = 500, res.end(JSON.stringify({ error: 'Missing GOOGLE_API_KEY in dev env' }));
						const chunks: Uint8Array[] = [];
						for await (const chunk of req) chunks.push(chunk);
						const raw = chunks.length ? Buffer.concat(chunks).toString() : '';
						let body = {};
						try { body = raw ? JSON.parse(raw) : {}; } catch (e) { /* ignore */ }
						const { model, imageBase64, prompt } = body as any;
						if (!model) return res.statusCode = 400, res.end(JSON.stringify({ error: 'Missing model in request body' }));
						const ai = new GoogleGenAI({ apiKey: key });
						const parts: any[] = [];
						if (imageBase64) {
							const cleanBase64 = String(imageBase64).replace(/^data:image\/(png|jpg|jpeg);base64,/, '');
							parts.push({ inlineData: { mimeType: 'image/png', data: cleanBase64 } });
						}
						const defaultPrompt = `Analyze this image of a mail envelope. Perform Optical Character Recognition (OCR) to extract the recipient and address details. Based on the extracted PIN/ZIP code and City, classify this mail item into a logical Sorting Center. Return the result purely as a valid JSON object with the following structure. Do not use markdown code blocks. { "recipient": "string", "address": "string", "pin_code": "string", "city": "string", "country": "string", "sorting_center_id": "string", "sorting_center_name": "string", "confidence": number } IMPORTANT: Return "confidence" as an integer between 0 and 100 (e.g., 95, not 0.95).`;
						parts.push({ text: prompt || defaultPrompt });
						const response: any = await ai.models.generateContent({ model, contents: { parts }, config: { temperature: 0.1 } });
						let text: string = response?.text || '';
						if (!text) {
							const out = response?.output || response?.outputs || [];
							if (Array.isArray(out) && out.length > 0) {
								const first = out[0];
								if (first?.content && Array.isArray(first.content)) text = first.content.map((c: any) => c.text || c).join('\n');
							}
						}
						res.setHeader('Content-Type', 'application/json');
						res.setHeader('Access-Control-Allow-Origin', '*');
						if (!text) return res.statusCode = 502, res.end(JSON.stringify({ error: 'Empty response from model', raw: response }));
						let jsonText = String(text || '').trim();
						if (jsonText.includes('```json')) jsonText = jsonText.replace(/```json/g, '').replace(/```/g, '');
						else if (jsonText.includes('```')) jsonText = jsonText.replace(/```/g, '');
						try {
							const parsed = JSON.parse(jsonText);
							return res.end(JSON.stringify({ ok: true, parsed, rawText: jsonText }));
						} catch (parseErr) {
							return res.statusCode = 502, res.end(JSON.stringify({ error: 'Model returned non-JSON or malformed JSON', rawText: jsonText }));
						}
					} catch (err) {
						console.error('[vite:gemini-proxy] error', err);
						try { res.statusCode = 500; res.end(JSON.stringify({ error: 'Gemini proxy error' })); } catch (e) {}
					}
				});
		}
	});

	return {
		plugins: [react(), hfProxyPlugin()],
		define: {
			// Provide a minimal `process` shim for browser bundles to avoid
			// runtime ReferenceError when dependencies reference `process`.
			'process': JSON.stringify({ env: {} }),
			'process.env.API_KEY': JSON.stringify(env.API_KEY || ''),
			'process.env.HF_API_KEY': JSON.stringify(HF_KEY)
		},
		server: {
			port: 5173
		}
	};
});

