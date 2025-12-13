# llmjobparser UI

Next.js (App Router) UI for the llmjobparser project with saved search alerts via Telegram.

## Features

- **Job Search**: LLM-powered vacancy search with prompt parsing and scoring
- **Saved Searches**: Save search queries with custom names
- **Alert Schedules**: Configure daily/weekly/custom cron notifications
- **Telegram Notifications**: Receive new vacancy alerts via Telegram bot
- **Database Persistence**: PostgreSQL with Drizzle ORM
- **Caching**: Vercel KV for efficient search operations

## Local development

```bash
pnpm install
pnpm dev
```

Open http://localhost:3000.

## Quick Start

For setting up saved searches and alerts, see:

- **[QUICKSTART_SAVED_SEARCHES.md](./QUICKSTART_SAVED_SEARCHES.md)** - Step-by-step local setup guide
- **[SAVED_SEARCHES.md](./SAVED_SEARCHES.md)** - Complete feature documentation
- **[SEARCH_API.md](./SEARCH_API.md)** - Search API documentation

## Environment variables

Copy `.env.example` to `.env.local` and fill what you need.

### Required for Search API

- `OPENROUTER_API_KEY` – OpenRouter API key
- `OPENROUTER_BASE_URL` – defaults to `https://openrouter.ai/api/v1`
- `KV_REST_API_URL` / `KV_REST_API_TOKEN` – Vercel KV REST credentials

### Required for Saved Searches

- `POSTGRES_URL` – Postgres connection string

### Optional for Notifications

- `TELEGRAM_BOT_TOKEN` – Bot token from @BotFather
- `TELEGRAM_ADMIN_CHAT_ID` – Your Telegram chat ID
- `CRON_SECRET` – Secret for securing cron endpoint
- `NEXT_PUBLIC_APP_URL` – App URL for deep links

## Database Setup

```bash
# Generate migration
pnpm db:generate

# Apply schema to database
pnpm db:push

# Seed test data
pnpm db:seed

# Open Drizzle Studio
pnpm db:studio
```

## Testing

```bash
# Run unit tests
pnpm test

# Test cron job locally
./scripts/test-cron.sh
```

## Pages

- `/` - Job search interface
- `/saved` - Saved searches dashboard

## API Routes

- `POST /api/search` - Execute job search
- `GET /api/saved-searches` - List user's saved searches
- `POST /api/saved-searches` - Create new saved search
- `PATCH /api/saved-searches/[id]` - Update saved search
- `DELETE /api/saved-searches/[id]` - Delete saved search
- `POST /api/cron/notifications` - Cron job for sending notifications
