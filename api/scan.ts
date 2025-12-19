import type { VercelRequest, VercelResponse } from '@vercel/node';

// This serverless function proxies a client-provided data URL (base64 image)
// to the configured RENDER_SCAN_URL (set as an environment variable in Vercel).
// It constructs a multipart/form-data body and forwards the request, adding
// the `ngrok-skip-browser-warning` header so the ngrok/render interstitial
// is bypassed for programmatic calls.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const RENDER_SCAN_URL = process.env.RENDER_SCAN_URL;
  if (!RENDER_SCAN_URL) return res.status(500).json({ error: 'RENDER_SCAN_URL not configured on server' });

  try {
    const body = req.body || {};
    // Accept either { dataUrl } JSON or raw body with dataUrl string
    const dataUrl: string = typeof body === 'string' ? body : body.dataUrl || body.data;
    if (!dataUrl) return res.status(400).json({ error: 'Missing dataUrl in request body' });

    // Parse data URL
    const m = dataUrl.match(/^data:(.+);base64,(.+)$/);
    const mime = m ? m[1] : 'image/png';
    const b64 = m ? m[2] : dataUrl;
    const buffer = Buffer.from(b64, 'base64');

    // Build multipart body manually
    const boundary = '----SmartMailBoundary' + Date.now();
    const header = Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="envelope.png"\r\nContent-Type: ${mime}\r\n\r\n`, 'utf8');
    const footer = Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8');
    const multipart = Buffer.concat([header, buffer, footer]);

    const forwardResp = await fetch(RENDER_SCAN_URL, {
      method: 'POST',
      headers: {
        // required by ngrok to bypass browser interstitial for programmatic calls
        'ngrok-skip-browser-warning': 'true',
        'Content-Type': `multipart/form-data; boundary=${boundary}`
      },
      body: multipart
    });

    const text = await forwardResp.text();
    // Mirror status and body back to client for debugging
    res.status(forwardResp.status).set({ 'content-type': 'text/plain; charset=utf-8' }).send(text);
  } catch (err: any) {
    console.error('[api/scan] proxy error', err);
    res.status(500).json({ error: String(err) });
  }
}
