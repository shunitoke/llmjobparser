# Saved Searches & Alerts

This document describes the saved searches and notification system for job vacancy alerts.

## Overview

Users can save their search queries with notification schedules to receive Telegram alerts when new matching vacancies are found. The system uses:

- **PostgreSQL** database with Drizzle ORM for data persistence
- **Vercel Cron** for scheduled notifications
- **Telegram Bot API** for delivering notifications
- **Vercel KV** cache reuse for efficient search execution

## Database Schema

### Tables

- **users**: User accounts with optional Telegram chat IDs
- **saved_searches**: Saved search queries with filters and schedules
- **sent_notifications**: Records of which vacancy IDs have been sent for each search
- **notification_logs**: Audit trail of notification executions

### Migrations

Generate a new migration:

```bash
pnpm db:generate
```

Apply migrations to database:

```bash
pnpm db:push
```

View database in Drizzle Studio:

```bash
pnpm db:studio
```

Seed development data:

```bash
pnpm db:seed
```

## API Routes

### Saved Searches

**GET /api/saved-searches?userId={userId}**

- Lists all saved searches for a user
- Returns: `{ searches: SavedSearch[] }`

**POST /api/saved-searches**

- Creates a new saved search
- Body:
  ```json
  {
    "userId": "uuid",
    "name": "Senior Backend Jobs",
    "prompt": "Senior backend engineer...",
    "regions": ["Remote", "Europe"],
    "categories": ["Software Engineering"],
    "includePrivate": false,
    "scheduleEnabled": true,
    "scheduleType": "daily",
    "scheduleCron": "0 9 * * *"
  }
  ```

**PATCH /api/saved-searches/[id]**

- Updates a saved search
- Requires `userId` in body for authorization
- Supports partial updates

**DELETE /api/saved-searches/[id]?userId={userId}**

- Deletes a saved search
- Cascades to sent_notifications and notification_logs

### Cron Job

**POST /api/cron/notifications**

- Executed by Vercel Cron (configured in `vercel.json`)
- Protected by `Authorization: Bearer {CRON_SECRET}` header
- Processes all enabled saved searches
- Sends Telegram notifications for new vacancies only

## Schedule Types

- **daily**: Runs at 9 AM every day (`0 9 * * *`)
- **weekly**: Runs at 9 AM every Monday (`0 9 * * 1`)
- **custom**: User-provided cron expression

## Notification Flow

1. Cron job triggers at scheduled intervals
2. For each enabled saved search:
   - Run the search pipeline (reusing cached prompts, vacancies, scores)
   - Query `sent_notifications` to filter out already-seen vacancy IDs
   - Format new vacancies as Telegram message (top 10 shown, with badges)
   - Send message to user's `telegram_chat_id` (or admin chat as fallback)
   - Insert new vacancy IDs into `sent_notifications`
   - Log execution in `notification_logs`

## Telegram Bot Setup

### Environment Variables

```env
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_ADMIN_CHAT_ID=your_chat_id_for_testing
NEXT_PUBLIC_APP_URL=https://your-app-url.vercel.app
CRON_SECRET=random_secret_for_cron_auth
```

### Getting Started

1. Create a bot via [@BotFather](https://t.me/botfather)
2. Get your bot token and set `TELEGRAM_BOT_TOKEN`
3. Find your chat ID (send a message to your bot, then call `https://api.telegram.org/bot{token}/getUpdates`)
4. Set `TELEGRAM_ADMIN_CHAT_ID` for testing
5. Users can optionally add their own chat ID to receive personalized notifications

### Message Format

Notifications include:

- Search name
- Count of new vacancies
- Top 10 vacancies with:
  - Job title and company
  - Location
  - LLM-generated badges
  - Deep link back to the app
- Note about additional vacancies if >10

## UI Components

### SaveSearchDialog

Modal dialog for creating a new saved search from current form state:

- Search name input
- Enable/disable notifications toggle
- Schedule type selector (daily/weekly/custom)
- Custom cron expression input (for custom schedule)

### SavedSearchesList

List view of user's saved searches with:

- Search details (name, prompt, filters)
- Schedule status badge
- Toggle notifications button
- Delete button

### Navigation

- Main search page: `/`
- Saved searches page: `/saved`

## Local Development

### Prerequisites

- PostgreSQL database (local or hosted)
- Telegram bot token (optional, for notifications)
- Vercel KV credentials (optional, for caching)

### Setup

1. Copy `.env.example` to `.env.local`
2. Fill in `POSTGRES_URL` connection string
3. Generate and apply migrations:
   ```bash
   pnpm db:generate
   pnpm db:push
   ```
4. Seed test data:
   ```bash
   pnpm db:seed
   ```
5. Start dev server:
   ```bash
   pnpm dev
   ```

### Testing Cron Job Locally

Send a POST request to the cron endpoint:

```bash
curl -X POST http://localhost:3000/api/cron/notifications \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json"
```

The response shows which searches were processed and how many new vacancies were found.

## Production Deployment

### Vercel Configuration

The `vercel.json` file configures the cron schedule:

```json
{
  "crons": [
    {
      "path": "/api/cron/notifications",
      "schedule": "0 9 * * *"
    }
  ]
}
```

### Environment Variables

Set these in Vercel project settings:

- `POSTGRES_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`
- `CRON_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `KV_REST_API_URL` (for caching)
- `KV_REST_API_TOKEN` (for caching)

### Database Migrations

Apply migrations via:

```bash
pnpm db:push
```

Or run migrations as part of build process in `vercel.json` build command.

## Security

- All API routes check `userId` to ensure users can only access their own data
- Cron endpoint requires `CRON_SECRET` authorization header
- Database queries use parameterized queries via Drizzle ORM
- Cascade deletes prevent orphaned records

## Performance

- Search pipeline reuses existing KV cache entries (prompt parsing, vacancy batches, scores)
- Sent notifications table prevents duplicate alerts
- Database indexes on foreign keys and frequently queried columns
- Batch scoring for efficient LLM calls

## Testing

The acceptance criteria are met when:

1. ✅ Users can save a search with a name and schedule
2. ✅ Saved searches appear in `/saved` dashboard
3. ✅ Users can toggle notification schedule on/off
4. ✅ Cron job processes enabled searches
5. ✅ Only new (unseen) vacancy IDs trigger notifications
6. ✅ Telegram messages include vacancy details and app links
7. ✅ Notification logs persist execution history

To test locally:

1. Run `pnpm db:seed` to create test user and searches
2. Visit `/saved` to see saved searches
3. Trigger cron manually via curl
4. Check console logs for notification processing
5. If Telegram is configured, check for bot messages
