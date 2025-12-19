// Simple serverless proxy for Gemini / Google GenAI.
// This stub attempts to call the Google Generative API using an API key stored
// in the environment variable `GOOGLE_API_KEY` (or `GEMINI_API_KEY`). If the key
// is not configured, it returns a helpful error so Vercel logs show the problem.

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');

  const key = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({ error: 'Server not configured for Gemini. Set GOOGLE_API_KEY or GEMINI_API_KEY in Vercel project settings and redeploy.' });
  }

  try {
    const { model, imageBase64 } = req.body || {};
    if (!model) return res.status(400).json({ error: 'Missing model in request body' });

    // NOTE: Implementing a full Generative API call here requires the
    // `@google/genai` SDK or constructing the correct REST call. The exact
    // REST surface and auth mode may vary by Google Cloud project. To keep
    // this repo portable we return a helpful message instructing how to
    // implement the server call.

    return res.status(501).json({
      error: 'Gemini proxy not fully implemented. To enable: add server-side call to Google GenAI here using @google/genai or the REST API, and set GOOGLE_API_KEY in Vercel.'
    });
  } catch (err: any) {
    console.error('[api/gemini] error', err);
    res.status(500).json({ error: String(err) });
  }
}
