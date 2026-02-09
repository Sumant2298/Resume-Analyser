# Resume Analyser (MVP)

Upload a resume + JD, get a match score, compensation fit, gap analysis, and actionable resume improvements. Unlimited analyses with no login required.

## Stack
- Next.js (App Router)
- Tailwind CSS
- No authentication required
- Groq API (free tier, OpenAI‑compatible)
- PDF/DOCX parsing via `pdf-parse` + `mammoth`

## Setup

1) Install deps
```bash
npm install
```

2) Create `.env.local`
```bash
GROQ_API_KEY=YOUR_GROQ_KEY
GROQ_MODEL=llama-3.1-8b-instant
SKILL_WEIGHT=0.8
```

3) Run
```bash
npm run dev
```

## Notes
- Resume/JD files are processed in memory only and not stored on the server.
- Unlimited analyses; no login required.
- Report downloads are available in Markdown and PDF.
- Render deployment: set the env vars above and use `npm run build` + `npm run start`.
- Overall score uses `SKILL_WEIGHT` for the match score and `1 - SKILL_WEIGHT` for salary fit.

## Deploy (Render)
- Create a new Web Service from this repo.
- Build command: `npm run build`
- Start command: `npm run start`
- Add env vars from `.env.local` in the Render dashboard.
- Use the included `render.yaml` blueprint for easy deployment.

### Render Blueprint
This repo includes a `render.yaml` blueprint. You can deploy with it and then fill in the secret env vars in the Render UI.
