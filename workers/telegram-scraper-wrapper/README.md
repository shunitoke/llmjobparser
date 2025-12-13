# Telegram Scraper Node.js Wrapper

A lightweight TypeScript/Node.js wrapper for triggering the Python Telegram scraper from Next.js API routes or Vercel Functions. Provides both programmatic API and HTTP endpoint handlers.

## Features

- **Async process spawning**: Runs Python scraper in child process
- **JSON result parsing**: Automatically parses scraper output
- **Error handling**: Comprehensive error capture and reporting
- **TypeScript support**: Fully typed API
- **Flexible parameters**: Pass options through function calls or HTTP requests
- **Vercel integration**: Ready for Vercel Functions and Edge Middleware

## Installation

```bash
# Install dependencies
pnpm install

# Build TypeScript
pnpm build
```

## Programmatic API

### Basic Usage

```typescript
import { triggerScraper, scrapeRegions, scrapeAll } from './src/index';

// Scrape all configured regions
const result = await scrapeAll();

// Scrape specific regions
const result = await scrapeRegions(['moscow', 'spb']);
const result = await scrapeRegions('moscow');

// Scrape with options
const result = await triggerScraper({
  regions: 'moscow,spb',
  limit: 50,
  dryRun: true,
});

console.log(result);
// {
//   success: true,
//   message: "Scraper completed successfully",
//   data: { ... }
// }
```

### API Reference

#### `triggerScraper(options?: ScrapeOptions): Promise<ScrapeResult>`

Trigger the Python scraper with custom options.

**Parameters:**
- `options.regions?: string` - Comma-separated region list or "all"
- `options.limit?: number` - Messages to fetch per channel
- `options.skipKv?: boolean` - Skip Vercel KV storage
- `options.dryRun?: boolean` - Fetch without storing

**Returns:** `ScrapeResult` with success status, message, and optional data

#### `scrapeRegions(regions: string | string[], options?): Promise<ScrapeResult>`

Convenience function to scrape specific regions.

**Parameters:**
- `regions` - Region name(s) to scrape
- `options` - ScrapeOptions (minus regions)

#### `scrapeAll(options?): Promise<ScrapeResult>`

Convenience function to scrape all configured regions.

**Parameters:**
- `options` - ScrapeOptions (minus regions)

## HTTP API Integration

### Next.js API Route Example

Create `/app/api/scraper/telegram/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { triggerScraper, scrapeRegions, scrapeAll } from '@/workers/telegram-scraper-wrapper/src/index';

export const runtime = 'nodejs';
export const maxDuration = 300; // 5 minutes

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    
    let result;
    
    if (body.action === 'scrape-all') {
      result = await scrapeAll({
        limit: body.limit,
        skipKv: body.skip_kv,
        dryRun: body.dry_run,
      });
    } else if (body.regions) {
      result = await scrapeRegions(body.regions, {
        limit: body.limit,
        skipKv: body.skip_kv,
        dryRun: body.dry_run,
      });
    } else {
      return NextResponse.json(
        { error: 'regions or action parameter required' },
        { status: 400 }
      );
    }
    
    return NextResponse.json(result, {
      status: result.success ? 200 : 500,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

### HTTP Endpoint Usage

```bash
# Scrape all regions
curl -X POST http://localhost:3000/api/scraper/telegram \
  -H "Content-Type: application/json" \
  -d '{"action": "scrape-all"}'

# Scrape specific regions
curl -X POST http://localhost:3000/api/scraper/telegram \
  -H "Content-Type: application/json" \
  -d '{"regions": "moscow,spb", "limit": 50}'

# Dry run
curl -X POST http://localhost:3000/api/scraper/telegram \
  -H "Content-Type: application/json" \
  -d '{"regions": "moscow", "dry_run": true}'
```

### Request Body Schema

```typescript
{
  // Action to perform
  "action": "scrape" | "scrape-all" | "scrape-regions",
  
  // Regions to scrape (required if action is not "scrape-all")
  "regions": "moscow" | "moscow,spb" | ["moscow", "spb"],
  
  // Optional: message limit per channel
  "limit": 100,
  
  // Optional: skip KV storage
  "skip_kv": false,
  
  // Optional: dry run mode
  "dry_run": false
}
```

### Response Schema

Success response:
```json
{
  "success": true,
  "message": "Scraper completed successfully",
  "data": {
    "status": "success",
    "regions_processed": ["moscow"],
    "results": {
      "moscow": [
        {
          "title": "Developer",
          "body": "...",
          "region": "moscow",
          "posted_at": "2024-01-10T14:30:00",
          "message_id": 12345,
          "source_channel": "@channel",
          "pay": "200000 ₽"
        }
      ]
    },
    "total_vacancies": 1
  }
}
```

Error response:
```json
{
  "success": false,
  "message": "Scraper failed with exit code 1",
  "error": "Error details from Python scraper..."
}
```

## Vercel Cron Integration

### Setup Vercel Cron Jobs

Create `/api/cron/telegram-scraper.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { scrapeAll } from '@/workers/telegram-scraper-wrapper/src/index';

export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  // Verify Cron secret for security
  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const result = await scrapeAll({ limit: 100 });
    
    return NextResponse.json(
      {
        success: result.success,
        message: result.message,
        timestamp: new Date().toISOString(),
      },
      { status: result.success ? 200 : 500 }
    );
  } catch (error) {
    console.error('Cron handler error:', error);
    return NextResponse.json(
      {
        error: 'Scraper failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
```

### Configure in vercel.json

```json
{
  "crons": [
    {
      "path": "/api/cron/telegram-scraper",
      "schedule": "0 */6 * * *"
    }
  ]
}
```

**Schedule options:**
- `0 */4 * * *` - Every 4 hours
- `0 */6 * * *` - Every 6 hours
- `0 0 * * *` - Daily at midnight UTC
- `0 8,14,20 * * *` - Three times daily (8am, 2pm, 8pm UTC)

## Supabase Queue Integration (Optional)

For async processing via Supabase Edge Functions:

```typescript
// In your Supabase Edge Function
import { triggerScraper } from '@/workers/telegram-scraper-wrapper/src/index';

Deno.serve(async (req) => {
  const payload = await req.json();
  
  const result = await triggerScraper({
    regions: payload.regions,
    limit: payload.limit,
  });
  
  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

Queue producer in Next.js:
```typescript
// app/api/queue/telegram-scraper/route.ts
import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const body = await req.json();
  
  // Queue message for async processing
  const { error } = await supabase.functions.invoke('telegram-scraper', {
    body: {
      regions: body.regions || 'all',
      limit: body.limit || 100,
    },
  });
  
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
  
  return NextResponse.json({ queued: true });
}
```

## Environment Variables

The wrapper inherits all Python scraper env vars:

```bash
# In .env.local or Vercel environment
TELEGRAM_API_ID=123456
TELEGRAM_API_HASH="your_hash"
TELETHON_SESSION="/tmp/telethon_session"
KV_REST_API_URL="https://your-instance.vercel-kv.com"
KV_REST_API_TOKEN="your_token"
REGION_CHANNEL_MAP='{"moscow": ["@jobs_moscow"]}'

# Optional for Vercel Cron security
CRON_SECRET="your_secret_key"
```

## Local Development

```bash
# Install and build
pnpm install
pnpm build

# Run example (ensure Python env vars are set)
node dist/index.js

# In Next.js project, test API route:
curl -X POST http://localhost:3000/api/scraper/telegram \
  -H "Content-Type: application/json" \
  -d '{"regions": "moscow"}'
```

## Logging

The wrapper logs all subprocess output with prefixes:

```
[SCRAPER] Starting scrape...
[SCRAPER] Processing region: moscow
[SCRAPER ERROR] Connection timeout
```

Standard output and errors are also captured and returned in the `error` field of the response.

## Performance Notes

- **Timeout**: Default process timeout is 5 minutes (adjust with Next.js `maxDuration`)
- **Memory**: Python process runs in child process with isolated memory
- **Concurrent runs**: Multiple triggers are safe due to process isolation
- **KV writes**: Each region write is ~10-50ms depending on vacancy count

## TypeScript Types

```typescript
interface ScrapeOptions {
  regions?: string;        // e.g., "moscow,spb"
  limit?: number;          // default: 100
  skipKv?: boolean;        // default: false
  dryRun?: boolean;        // default: false
}

interface ScrapeResult {
  success: boolean;
  message: string;
  data?: Record<string, unknown>;  // Scraper JSON output
  error?: string;                   // Error details if failed
}
```

## Troubleshooting

### "Failed to start scraper process"

- **Cause**: Python not found or wrong path
- **Fix**: Ensure Python 3 is installed and accessible as `python3`
```bash
which python3
python3 --version
```

### "Scraper failed with exit code 1"

- **Cause**: Environment variables not set or configuration error
- **Fix**: Check Python scraper logs in the error response
```bash
# Test Python scraper directly
python3 workers/telegram_scraper/main.py --dry-run
```

### Process hangs/timeout

- **Cause**: Telegram connection slow or channel unreachable
- **Fix**: Increase Next.js timeout in `route.ts` with `export const maxDuration = 300;`

## Related Files

- Python scraper: `../telegram_scraper/`
- Python documentation: `../telegram_scraper/README.md`

## License

MIT
