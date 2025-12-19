// Simple Vercel serverless proxy to forward requests to Hugging Face Inference API
// Uses server-side `HF_API_KEY` from environment (do NOT expose this to client)

export default async function handler(req, res) {
  try {
    const HF_KEY = process.env.HF_API_KEY;
    if (!HF_KEY) {
      res.statusCode = 500;
      res.end('HF_API_KEY not configured on server');
      return;
    }

    // Compute target path by stripping /api/hf prefix
    const targetPath = (req.url || '').replace(/^\/api\/hf/, '') || '/';
    const target = `https://api-inference.huggingface.co${targetPath}`;

    // Collect request body
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    const body = chunks.length ? Buffer.concat(chunks) : undefined;

    // Build headers and inject HF key server-side
    const outgoingHeaders = {};
    if (req.headers['content-type']) outgoingHeaders['content-type'] = String(req.headers['content-type']);
    outgoingHeaders['authorization'] = `Bearer ${HF_KEY}`;

    const fetchRes = await fetch(target, {
      method: req.method,
      headers: outgoingHeaders,
      body
    });

    // Relay status and headers (skip hop-by-hop headers)
    res.statusCode = fetchRes.status;
    fetchRes.headers.forEach((value, key) => {
      const skip = ['transfer-encoding', 'connection', 'keep-alive'];
      if (skip.includes(key.toLowerCase())) return;
      try { res.setHeader(key, value); } catch (e) {}
    });

    const arrayBuffer = await fetchRes.arrayBuffer();
    res.end(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('[api/hf] proxy error', err);
    try { res.statusCode = 502; res.end('Proxy error'); } catch (e) {}
  }
}
