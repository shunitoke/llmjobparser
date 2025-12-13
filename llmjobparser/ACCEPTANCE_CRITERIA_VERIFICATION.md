# Acceptance Criteria Verification

This document provides step-by-step verification for each acceptance criterion from the ticket.

## Ticket Requirements

> Users can save a search with a schedule, see it listed in their dashboard, and a cron invocation simulates sending Telegram notifications that include only previously unseen vacancy IDs while persisting notification logs.

## Acceptance Criteria Checklist

### ✅ 1. Users can save a search with a schedule

**Implementation:**
- UI: `src/components/saved-searches/save-search-dialog.tsx`
- API: `POST /api/saved-searches`
- Database: `saved_searches` table with schedule fields

**Verification Steps:**
1. Visit http://localhost:3000
2. Enter search criteria and click "Search"
3. Click "Save Search" button (appears after search completes)
4. Fill in:
   - Name: "Test Backend Jobs"
   - Enable Notifications: ON
   - Frequency: Daily
5. Click "Save"
6. Check response returns 201 with saved search object

**Files:**
```
src/components/saved-searches/save-search-dialog.tsx:50-100 (Save dialog UI)
src/app/api/saved-searches/route.ts:56-110 (POST handler)
src/lib/db/schema.ts:21-42 (saved_searches table schema)
```

**Test Command:**
```bash
curl -X POST http://localhost:3000/api/saved-searches \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "test-user-id",
    "name": "Test Search",
    "prompt": "Senior backend engineer",
    "regions": ["Remote"],
    "categories": ["Software Engineering"],
    "scheduleEnabled": true,
    "scheduleType": "daily"
  }'
```

---

### ✅ 2. See it listed in their dashboard

**Implementation:**
- Page: `src/app/(search)/saved/page.tsx`
- Component: `src/components/saved-searches/saved-searches-list.tsx`
- API: `GET /api/saved-searches?userId={userId}`
- Route: `/saved`

**Verification Steps:**
1. Visit http://localhost:3000/saved
2. Verify saved searches are displayed
3. Check each card shows:
   - Search name
   - Prompt text
   - Regions and categories as badges
   - Schedule status badge (Daily/Weekly/Custom)
   - Bell icon (toggle notifications)
   - Trash icon (delete)

**Files:**
```
src/app/(search)/saved/page.tsx (Page component)
src/components/saved-searches/saved-searches-list.tsx:50-135 (List component)
src/app/api/saved-searches/route.ts:20-50 (GET handler)
```

**Test Command:**
```bash
curl "http://localhost:3000/api/saved-searches?userId=test-user-id"
```

---

### ✅ 3. Cron invocation simulates sending Telegram notifications

**Implementation:**
- Endpoint: `POST /api/cron/notifications`
- Telegram Client: `src/lib/telegram.ts`
- Cron Config: `vercel.json`
- Schedule: Daily at 9 AM UTC

**Verification Steps:**
1. Set environment variables:
   ```bash
   export TELEGRAM_BOT_TOKEN="your-token"
   export TELEGRAM_ADMIN_CHAT_ID="your-chat-id"
   export CRON_SECRET="test-secret"
   ```
2. Run seed script to create test data:
   ```bash
   pnpm db:seed
   ```
3. Trigger cron manually:
   ```bash
   ./scripts/test-cron.sh
   ```
4. Check response shows processed searches:
   ```json
   {
     "processed": 2,
     "results": [
       {
         "searchId": "uuid",
         "searchName": "Senior Backend Engineer",
         "status": "success",
         "newVacanciesCount": 0
       }
     ]
   }
   ```
5. If Telegram is configured and there are new vacancies, check bot messages

**Files:**
```
src/app/api/cron/notifications/route.ts:28-133 (Cron handler)
src/lib/telegram.ts:10-46 (Bot client)
vercel.json (Cron schedule config)
scripts/test-cron.sh (Test script)
```

**Test Command:**
```bash
curl -X POST http://localhost:3000/api/cron/notifications \
  -H "Authorization: Bearer test-secret"
```

---

### ✅ 4. Include only previously unseen vacancy IDs

**Implementation:**
- Table: `sent_notifications` (saved_search_id, vacancy_id)
- Logic: `src/app/api/cron/notifications/route.ts:222-243`
- Diff: Filter vacancies not in sent_notifications set

**Verification Steps:**
1. Ensure database has test data:
   ```bash
   pnpm db:seed
   ```
2. Trigger cron job twice:
   ```bash
   ./scripts/test-cron.sh
   ./scripts/test-cron.sh
   ```
3. First run: All vacancies are new (sent)
4. Second run: No new vacancies (0 sent)
5. Verify in database:
   ```bash
   pnpm db:studio
   # Check sent_notifications table
   ```

**Files:**
```
src/app/api/cron/notifications/route.ts:222-243 (Diff logic)
src/lib/db/schema.ts:44-60 (sent_notifications table)
```

**SQL Check:**
```sql
SELECT 
  ss.name,
  COUNT(sn.id) as sent_count
FROM saved_searches ss
LEFT JOIN sent_notifications sn ON ss.id = sn.saved_search_id
GROUP BY ss.id, ss.name;
```

---

### ✅ 5. Persisting notification logs

**Implementation:**
- Table: `notification_logs` (saved_search_id, vacancy_count, status, error_message, sent_at)
- Insert: On every cron execution per search
- Status: "success" or "error"

**Verification Steps:**
1. Run cron job:
   ```bash
   ./scripts/test-cron.sh
   ```
2. Check database for logs:
   ```bash
   pnpm db:studio
   # Navigate to notification_logs table
   ```
3. Verify each search has a log entry with:
   - saved_search_id
   - vacancy_count (number or "0")
   - status ("success" or "error")
   - error_message (if status is "error")
   - sent_at (timestamp)

**Files:**
```
src/app/api/cron/notifications/route.ts:88-92 (Success log)
src/app/api/cron/notifications/route.ts:103-108 (Error log)
src/lib/db/schema.ts:62-77 (notification_logs table)
```

**SQL Check:**
```sql
SELECT 
  nl.sent_at,
  ss.name as search_name,
  nl.vacancy_count,
  nl.status,
  nl.error_message
FROM notification_logs nl
JOIN saved_searches ss ON nl.saved_search_id = ss.id
ORDER BY nl.sent_at DESC
LIMIT 10;
```

---

## Additional Features Implemented

### Database Migrations
- Generated migration: `drizzle/0000_sloppy_sumo.sql`
- Migration script: `src/lib/db/migrate.ts`
- Commands: `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:push`

### Seed Data
- Script: `src/lib/db/seed.ts`
- Command: `pnpm db:seed`
- Creates: Test user, 2 saved searches (one with schedule enabled)

### UI Features
- Save search dialog with validation
- Saved searches list with actions
- Toggle notifications on/off
- Delete saved searches
- Navigation between Search and Saved pages

### API Authorization
- All routes check userId
- Cron endpoint requires Bearer token
- Database queries scoped to user

### Cache Reuse
- Reuses parsed prompt cache
- Reuses vacancy batch cache
- Reuses score cache
- Efficient execution

## Testing Commands

```bash
# Run unit tests
pnpm test

# Generate migration
pnpm db:generate

# Apply schema
pnpm db:push

# Seed test data
pnpm db:seed

# Open database UI
pnpm db:studio

# Test cron job
./scripts/test-cron.sh

# Lint code
pnpm lint

# Format code
pnpm format

# Build for production
pnpm build
```

## Environment Setup for Full Test

```bash
# 1. Set up .env.local
cp .env.example .env.local

# 2. Configure database
echo "POSTGRES_URL=postgresql://user:pass@host:5432/db" >> .env.local

# 3. Apply schema
pnpm db:push

# 4. Seed data
pnpm db:seed

# 5. (Optional) Configure Telegram
echo "TELEGRAM_BOT_TOKEN=your-token" >> .env.local
echo "TELEGRAM_ADMIN_CHAT_ID=your-chat-id" >> .env.local

# 6. Set cron secret
echo "CRON_SECRET=my-secret" >> .env.local

# 7. Start dev server
pnpm dev

# 8. Test in browser
# Visit http://localhost:3000
# Search, save, view saved, trigger cron

# 9. Test cron via API
export CRON_SECRET=my-secret
./scripts/test-cron.sh
```

## Success Indicators

All acceptance criteria are met when:

1. ✅ Save dialog saves search with schedule to database
2. ✅ Saved searches page lists all user's searches
3. ✅ Cron endpoint processes enabled searches
4. ✅ Only new vacancy IDs trigger notifications
5. ✅ Notification logs persist with status and counts
6. ✅ Telegram messages sent (when configured)
7. ✅ Deep links included in messages
8. ✅ All tests pass
9. ✅ Build succeeds
10. ✅ Lint passes

## Documentation

- `SAVED_SEARCHES.md` - Complete feature documentation
- `QUICKSTART_SAVED_SEARCHES.md` - Setup guide
- `IMPLEMENTATION_SUMMARY.md` - Implementation details
- `SEARCH_API.md` - Search API reference
- `README.md` - Project overview

All acceptance criteria have been implemented and are verifiable through the steps above.
