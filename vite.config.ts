import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

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

