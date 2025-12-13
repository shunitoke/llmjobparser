# Quick Start: Saved Searches & Alerts

This guide will help you set up and test the saved searches feature locally.

## Prerequisites

- Node.js 20+ and pnpm
- PostgreSQL database (local or hosted)
- Telegram bot (optional, for testing notifications)

## Step 1: Database Setup

### Option A: Local PostgreSQL

Install PostgreSQL locally and create a database:

```bash
createdb llmjobparser
```

### Option B: Hosted PostgreSQL

Use a hosted service like:

- Vercel Postgres
- Supabase
- Railway
- Neon

Get your connection string and continue to Step 2.

## Step 2: Environment Configuration

Copy the example environment file:

```bash
cd llmjobparser
cp .env.local.example .env.local
```

Edit `.env.local` and set at minimum:

```env
POSTGRES_URL=postgresql://postgres:password@localhost:5432/llmjobparser
CRON_SECRET=my-test-secret
```

## Step 3: Database Migrations

Generate and apply the database schema:

```bash
pnpm db:generate
pnpm db:push
```

This creates the tables:

- `users`
- `saved_searches`
- `sent_notifications`
- `notification_logs`

## Step 4: Seed Test Data

Load sample data for development:

```bash
pnpm db:seed
```

This creates:

- A test user: `dev@example.com`
- Two saved searches with different schedules

## Step 5: Start Development Server

```bash
pnpm dev
```

Visit http://localhost:3000

## Step 6: Test the UI

### Create a Saved Search

1. Go to http://localhost:3000
2. Enter a search prompt (e.g., "Senior backend engineer with Node.js")
3. Select regions and categories
4. Click "Search"
5. After results load, click "Save Search"
6. Give it a name and configure notifications
7. Click "Save"

### View Saved Searches

1. Go to http://localhost:3000/saved
2. You'll see your saved searches
3. Toggle notifications on/off with the bell icon
4. Delete searches with the trash icon

## Step 7: Test the Cron Job

### Manually Trigger the Cron

```bash
./scripts/test-cron.sh
```

Or with curl:

```bash
curl -X POST http://localhost:3000/api/cron/notifications \
  -H "Authorization: Bearer my-test-secret" \
  -H "Content-Type: application/json"
```

### Expected Response

```json
{
  "processed": 2,
  "results": [
    {
      "searchId": "uuid-here",
      "searchName": "Senior Backend Engineer",
      "status": "success",
      "newVacanciesCount": 0
    }
  ]
}
```

Note: You'll see 0 vacancies initially because:

1. The search pipeline needs real vacancy data
2. KV cache is empty (no batches yet)

## Step 8: (Optional) Telegram Integration

### Setup

1. Create a bot via [@BotFather](https://t.me/botfather)
2. Get your bot token
3. Send a message to your bot
4. Get your chat ID from: `https://api.telegram.org/bot{TOKEN}/getUpdates`
5. Add to `.env.local`:

```env
TELEGRAM_BOT_TOKEN=1234567890:ABCdefGHIjklMNOpqrsTUVwxyz
TELEGRAM_ADMIN_CHAT_ID=123456789
```

6. Restart the dev server

### Test Telegram Notifications

With Telegram configured, run the cron job again:

```bash
./scripts/test-cron.sh
```

If there are new vacancies (once you have real data), you'll receive a Telegram message with:

- Search name
- Count of new vacancies
- Top 10 vacancies with badges
- Deep links back to the app

## Step 9: Inspect Database

View your data in Drizzle Studio:

```bash
pnpm db:studio
```

This opens a web UI at http://localhost:4983 where you can:

- Browse all tables
- View saved searches
- Check sent notifications
- See notification logs

## API Testing

### Create a Saved Search

```bash
curl -X POST http://localhost:3000/api/saved-searches \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id",
    "name": "Test Search",
    "prompt": "Senior backend engineer",
    "regions": ["Remote"],
    "categories": ["Software Engineering"],
    "scheduleEnabled": true,
    "scheduleType": "daily"
  }'
```

### List Saved Searches

```bash
curl "http://localhost:3000/api/saved-searches?userId=your-user-id"
```

### Update a Search

```bash
curl -X PATCH http://localhost:3000/api/saved-searches/{search-id} \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "your-user-id",
    "scheduleEnabled": false
  }'
```

### Delete a Search

```bash
curl -X DELETE "http://localhost:3000/api/saved-searches/{search-id}?userId=your-user-id"
```

## Production Deployment

### Vercel

1. Push your code to GitHub
2. Import project to Vercel
3. Add environment variables in project settings
4. Deploy

The cron job is configured in `vercel.json`:

- Runs daily at 9 AM UTC
- Automatically secured by Vercel

### Environment Variables for Vercel

Set these in your Vercel project settings:

- `POSTGRES_URL`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ADMIN_CHAT_ID`
- `CRON_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `OPENROUTER_API_KEY`

## Troubleshooting

### Database Connection Errors

```
Error: Database not configured
```

→ Check that `POSTGRES_URL` is set in `.env.local`

### Cron 401 Unauthorized

```
{"error": "Unauthorized"}
```

→ Make sure you're sending `Authorization: Bearer {CRON_SECRET}` header

### No New Vacancies Found

This is expected when:

- KV cache is empty (no vacancy batches)
- All vacancies have already been sent

To test with data:

1. Populate KV with vacancy batches (via real search API)
2. Then run the cron job

### TypeScript Errors

```
'db' is possibly 'null'
```

→ Make sure you're checking `if (!db)` before using it in API routes

## Next Steps

- Add authentication (NextAuth, Clerk, etc.)
- Replace hardcoded `userId` with actual auth
- Set up real scraper workers to populate vacancy data
- Customize notification templates
- Add more schedule options (hourly, custom days)
- Implement notification history in UI
- Add unsubscribe links to Telegram messages

## Support

For issues or questions:

- Check SAVED_SEARCHES.md for detailed documentation
- Review test files for usage examples
- Inspect the API routes for implementation details
