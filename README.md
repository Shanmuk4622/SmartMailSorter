<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1ve1GE9xbhyFl80fFx-66VkE9OqA7SN1u

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

Hugging Face notes:
- If you want to use Hugging Face models (e.g., Llama-3.2-Vision) set `HF_API_KEY` in your `.env.local` (or use the provided example `.env.example`). Get a token from https://huggingface.co/settings/tokens and create a new "Read" or "Inference" token. The app will read `HF_API_KEY` at build time.
