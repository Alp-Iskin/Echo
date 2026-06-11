# Journal with Echo

*Your journal, reflected.*

A private journaling app where everything — entries, to-dos, and long-term
goals — lives only in your browser. Alongside your writing is **Echo**, an AI
companion that reads your journal and helps you reflect.

## Features

- **Journal** — write entries; search across everything.
- **To-dos & Goals** — track day-to-day tasks and longer-term goals beside your writing.
- **Echo (AI companion)** — chat with an assistant that has your journal, to-dos, and goals as context.
  - **Gemini** (default) — natural, capable replies via a server route that keeps your API key private.
  - **On-device** — a fully private/offline mode (WebLLM + WebGPU); nothing leaves your device.
- **Private by design** — no accounts, no database. Data is stored in `localStorage`. The only thing that leaves your device is the text sent to Gemini when you ask Echo (and only in Gemini mode).

## Getting started

```bash
npm install
cp .env.example .env.local   # then add your free key from https://aistudio.google.com/apikey
npm run dev
```

Open http://localhost:3000.

## Deploying (Netlify)

Push to GitHub and import the repo in Netlify — it auto-detects Next.js. Set
`GEMINI_API_KEY` in the site's environment variables, then deploy. The
`/api/echo` route runs as a serverless function so the key stays server-side.

## Tech

Next.js 16 · React 19 · Tailwind 4 · Gemini API · `@mlc-ai/web-llm`
