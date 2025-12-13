# Workers Setup Guide

This directory contains background workers for the LLM Job Parser application.

## Telegram Scraper Worker

A Python worker that scrapes job vacancy posts from Telegram channels and stores results in Vercel KV.

### Quick Start

1. **Install Python dependencies:**
```bash
cd telegram_scraper
pip install -r requirements.txt
```

2. **Get Telegram API credentials:**
   - Go to https://my.telegram.org
   - Create an application to get `TELEGRAM_API_ID` and `TELEGRAM_API_HASH`

3. **Set environment variables:**
```bash
export TELEGRAM_API_ID="your_id"
export TELEGRAM_API_HASH="your_hash"
export TELETHON_SESSION="/tmp/telethon_session"
export KV_REST_API_URL="https://your-instance.vercel-kv.com"
export KV_REST_API_TOKEN="your_token"
export REGION_CHANNEL_MAP='{"moscow": ["@jobs_moscow"], "spb": ["@jobs_spb"]}'
```

4. **Run the scraper:**
```bash
# Dry run (no KV storage)
python main.py --regions moscow --dry-run

# Full scrape
python main.py --regions all

# See all options
python main.py --help
```

5. **Run tests:**
```bash
pytest tests/ -v
```

### Documentation

See detailed documentation in:
- `telegram_scraper/README.md` - Python worker detailed guide
- `telegram-scraper-wrapper/README.md` - Node.js wrapper and API integration

### Key Features

✅ Telethon-based Telegram scraping  
✅ Automatic message deduplication (per-channel tracking)  
✅ Salary/region auto-detection  
✅ Vercel KV storage with TTL  
✅ Proxy support  
✅ Comprehensive test suite  
✅ CLI and API interfaces  

### Architecture

```
workers/
├── telegram_scraper/          # Python worker
│   ├── main.py               # CLI entry point
│   ├── config.py             # Environment configuration
│   ├── scraper.py            # Telethon scraper
│   ├── parser.py             # Message parsing
│   ├── kv_store.py           # Vercel KV integration
│   ├── models.py             # Data models
│   ├── requirements.txt       # Python dependencies
│   ├── README.md             # Detailed documentation
│   └── tests/                # Pytest test suite
│
└── telegram-scraper-wrapper/  # Node.js wrapper
    ├── package.json          # Dependencies
    ├── tsconfig.json         # TypeScript config
    ├── src/
    │   ├── index.ts         # Main API
    │   └── trigger.ts       # HTTP handler
    └── README.md            # API documentation
```

## Environment Variables Reference

### Required Variables

```bash
# Telegram API (get from https://my.telegram.org)
TELEGRAM_API_ID=123456
TELEGRAM_API_HASH="your_api_hash_string"

# Vercel KV
KV_REST_API_URL="https://your-db.vercel-kv.com"
KV_REST_API_TOKEN="your_kv_token"

# Region to channel mapping (JSON)
REGION_CHANNEL_MAP='{"moscow": ["@channel1", "@channel2"], "spb": ["@channel3"]}'
```

### Optional Variables

```bash
# Telegram session storage (default: /tmp/telethon_session)
TELETHON_SESSION="/path/to/session"

# Proxy support (SOCKS5 or HTTP)
TELEGRAM_PROXY_URL="socks5://proxy-ip:port"

# KV storage TTL in seconds (default: 18000 = 5 hours, recommend 14400-21600 for 4-6 hours)
KV_TTL_SECONDS=18000

# Cron security (if using Vercel Cron)
CRON_SECRET="your_secret"
```

## Integration with Next.js API

The Node.js wrapper can be integrated into your Next.js application for API endpoints and Vercel Cron jobs.

### Example API Route

Create `/app/api/scraper/telegram/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { scrapeAll, scrapeRegions } from '@/workers/telegram-scraper-wrapper/src/index';

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const body = await req.json();
  
  const result = body.action === 'scrape-all'
    ? await scrapeAll({ limit: body.limit })
    : await scrapeRegions(body.regions || 'all', { limit: body.limit });
  
  return NextResponse.json(result, {
    status: result.success ? 200 : 500,
  });
}
```

### Example Vercel Cron Job

In `vercel.json`:
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

## Deduplication Strategy

The scraper maintains `last_seen_id` per channel in Vercel KV:

```
Key: telegram:last_seen:{channel_name}
Value: {message_id}
```

**How it works:**
1. On startup, scraper loads `last_seen_id` for each channel
2. Only fetches messages with `id > last_seen_id`
3. After processing, updates `last_seen_id` to highest processed
4. Next run skips all previously seen messages

**To re-process old messages:**
```bash
# Delete the last_seen_id key
# Scraper will then fetch all messages (up to --limit)
# Be careful: may re-scrape many messages
```

## Data Storage Format

Vacancies are stored in Vercel KV with this structure:

```json
{
  "key": "vacancies:telegram:a1b2c3d4",
  "value": {
    "region": "moscow",
    "count": 5,
    "vacancies": [
      {
        "title": "Senior Python Developer",
        "body": "Full job description...",
        "region": "moscow",
        "posted_at": "2024-01-10T14:30:00",
        "message_id": 12345,
        "source_channel": "@jobs_moscow",
        "pay": "250000 ₽",
        "url": null
      }
    ],
    "updated_at": "2024-01-10T15:00:00",
    "expires_at": "2024-01-10T20:00:00"
  },
  "ttl": 18000
}
```

## Performance Guidelines

- **Fetch limit**: Default 100 messages/channel (adjust with `--limit`)
- **Run frequency**: Every 4-6 hours (recommended)
- **TTL**: 4-6 hours per specification
- **Deduplication**: Eliminates re-processing of old messages
- **Timeout**: Set Next.js `maxDuration` to at least 5 minutes

## Testing

```bash
cd telegram_scraper

# Run all tests
pytest

# Run with verbose output
pytest -v

# Test specific module
pytest tests/test_parsing.py -v

# With coverage
pytest --cov=. tests/
```

Test categories:
- **Message Parsing**: Extraction of titles, salaries, regions from Telegram text
- **KV Storage**: Vercel KV integration and deduplication
- **Models**: Data structure validation
- **Config**: Environment variable loading and validation

## Troubleshooting

### Common Issues

**"TELEGRAM_API_ID is required"**
```bash
# Make sure env var is set
export TELEGRAM_API_ID="your_id"
python telegram_scraper/main.py --dry-run
```

**"Telethon session not found" on first run**
- This is normal! Telethon will prompt for authentication
- Enter your phone number and verification code
- Session is then saved and reused for future runs

**"KV_REST_API_URL or KV_REST_API_TOKEN not set"**
```bash
# Set Vercel KV credentials
export KV_REST_API_URL="https://your-instance.vercel-kv.com"
export KV_REST_API_TOKEN="your_token"
```

**No vacancies found**
- Check channel names in `REGION_CHANNEL_MAP`
- Verify user account has access to channels
- Try `--dry-run` to see if messages are being fetched

**Process timeout in Next.js**
- Increase `maxDuration` in API route
- Check if Telegram connection is slow
- Consider reducing `--limit` parameter

## Next Steps

1. **Set up environment variables** in `.env.local` or Vercel dashboard
2. **Test locally** with `python telegram_scraper/main.py --regions moscow --dry-run`
3. **Create API route** for integration with Next.js
4. **Configure Vercel Cron** for periodic background runs
5. **Monitor KV storage** for vacancy updates

See individual READMEs for detailed documentation:
- `telegram_scraper/README.md` - Python worker guide
- `telegram-scraper-wrapper/README.md` - Node.js wrapper guide
