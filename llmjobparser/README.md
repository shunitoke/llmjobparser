# llmjobparser UI

Next.js (App Router) UI for the llmjobparser project.

## Local development

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Environment variables

Copy `.env.example` to `.env.local` and fill what you need.

Required for future (non-mock) search:

- `OPENROUTER_API_KEY` – OpenRouter API key
- `OPENROUTER_BASE_URL` – defaults to `https://openrouter.ai/api/v1`
- `POSTGRES_URL` – Postgres connection string
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` – Vercel KV REST credentials

The current UI uses a mock `/api/search` route and does **not** require these values to run.
