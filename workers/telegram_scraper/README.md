# Telegram Job Vacancy Scraper

A Python worker that scrapes job vacancy posts from Telegram channels using the Telethon library. Extracts structured vacancy metadata and stores results in Vercel KV with deduplication support.

## Features

- **Telethon-based scraping**: Uses Telethon userbot library for reliable Telegram access
- **Proxy support**: Configure SOCKS5 or HTTP proxy for connections
- **Session persistence**: Maintains session across runs to avoid re-authentication
- **Deduplication**: Tracks `last_seen_id` per channel to avoid processing duplicate messages
- **Metadata extraction**: Automatically extracts:
  - Job title (first meaningful line)
  - Full vacancy description
  - Salary/pay information (multiple formats supported)
  - Region (auto-detection from text)
  - Post timestamp
  - Message and channel IDs
- **Vercel KV integration**: Stores results with configurable TTL (4-6 hours)
- **CLI interface**: Command-line tool for manual and automated triggers
- **Comprehensive tests**: Pytest suite with message parsing and extraction examples

## Requirements

### Environment Variables

#### Telegram Configuration
```bash
# Telegram API credentials (get from https://my.telegram.org)
TELEGRAM_API_ID=123456
TELEGRAM_API_HASH="your_api_hash_here"

# Session storage path (default: /tmp/telethon_session)
TELETHON_SESSION="/path/to/session/file"

# Optional: Proxy configuration
TELEGRAM_PROXY_URL="socks5://proxy-ip:port"  # or http://proxy-ip:port
```

#### Vercel KV Configuration
```bash
# Vercel KV REST API credentials
KV_REST_API_URL="https://your-kv-instance.vercel-kv.com"
KV_REST_API_TOKEN="your_kv_token_here"

# Optional: TTL for stored vacancies (default: 18000 = 5 hours, recommend 14400-21600 for 4-6 hours)
KV_TTL_SECONDS=18000
```

#### Region-Channel Mapping
```bash
# JSON mapping of regions to Telegram channels to monitor
REGION_CHANNEL_MAP='{"moscow": ["@jobs_moscow", "@vacancies_msk"], "spb": ["@jobs_spb"], "remote": ["@remote_jobs"]}'
```

### Installation

1. Install Python 3.8+
2. Install dependencies:
```bash
pip install -r requirements.txt
```

## Usage

### CLI Entry Point

#### Basic usage - scrape all configured regions:
```bash
python main.py
```

#### Scrape specific regions:
```bash
python main.py --regions moscow,spb
```

#### Scrape with custom message limit:
```bash
python main.py --regions moscow --limit 50
```

#### Output to JSON file:
```bash
python main.py --regions all --output results.json
```

#### Dry run (fetch without storing in KV):
```bash
python main.py --regions moscow --dry-run
```

#### Skip KV storage, print to stdout:
```bash
python main.py --regions moscow --skip-kv
```

### Full CLI Options

```
usage: main.py [-h] [--regions REGIONS] [--limit LIMIT] [--output OUTPUT] 
               [--skip-kv] [--dry-run]

optional arguments:
  -h, --help           show this help message and exit
  --regions REGIONS    Comma-separated list of regions to scrape (or 'all')
                       (default: all)
  --limit LIMIT        Number of recent messages to fetch per channel
                       (default: 100)
  --output OUTPUT      Output JSON file (optional, defaults to stdout)
  --skip-kv            Skip storing results in Vercel KV
  --dry-run            Fetch messages but don't store in KV
```

### Example Output

```json
{
  "status": "success",
  "timestamp": null,
  "regions_processed": ["moscow", "spb"],
  "results": {
    "moscow": [
      {
        "title": "Senior Python Developer",
        "body": "Senior Python Developer Moscow Zarplata: 250000 rub Experience: 5+ years",
        "region": "moscow",
        "posted_at": "2024-01-10T14:30:00",
        "message_id": 12345,
        "source_channel": "@jobs_moscow",
        "pay": "250000 rub",
        "url": null
      }
    ],
    "spb": []
  },
  "total_vacancies": 1
}
```

## Data Storage (Vercel KV)

### Key Structure

```
vacancies:telegram:{region_hash}
  - Stores array of vacancies for the region
  - Example key: vacancies:telegram:a1b2c3d4
  - TTL: configurable (default 5 hours)
  
telegram:last_seen:{channel_name}
  - Stores highest message_id processed for deduplication
  - Example key: telegram:last_seen:@jobs_moscow
  - No TTL (permanent until manually cleared)
```

### Example KV Entry
```json
{
  "region": "moscow",
  "count": 5,
  "vacancies": [
    {
      "title": "Python Developer",
      "body": "...",
      "region": "moscow",
      "posted_at": "2024-01-10T14:30:00",
      "message_id": 12345,
      "source_channel": "@jobs_moscow",
      "pay": "200000-250000 ₽"
    }
  ],
  "updated_at": "2024-01-10T15:00:00",
  "expires_at": "2024-01-10T20:00:00"
}
```

## Deduplication

The scraper avoids re-processing messages through:

1. **Per-channel tracking**: `last_seen_id` is stored separately for each channel
2. **Ascending ID fetch**: Only fetches messages with ID > `last_seen_id`
3. **Automatic updates**: Updates `last_seen_id` after successful processing
4. **Manual reset**: Clear `telegram:last_seen:{channel}` key in KV to re-process old messages

## Local Setup & Testing

### 1. Get Telegram API Credentials

- Visit https://my.telegram.org
- Go to API development tools
- Create an application to get `TELEGRAM_API_ID` and `TELEGRAM_API_HASH`

### 2. Set Environment Variables

```bash
# Create .env file in workers/telegram_scraper/
cat > .env << EOF
TELEGRAM_API_ID=123456
TELEGRAM_API_HASH="your_hash_here"
TELETHON_SESSION="/tmp/telethon_session"
KV_REST_API_URL="https://your-instance.vercel-kv.com"
KV_REST_API_TOKEN="your_token_here"
REGION_CHANNEL_MAP='{"test": ["@test_channel"]}'
EOF

# Load it
export $(cat .env | xargs)
```

### 3. Run Tests

```bash
# Install test dependencies
pip install -r requirements.txt

# Run all tests
pytest

# Run with verbose output
pytest -v

# Run specific test file
pytest tests/test_parsing.py

# Run with coverage
pytest --cov=. tests/
```

### 4. Manual Test Run

```bash
# Dry run (no KV storage)
python main.py --regions test --dry-run --skip-kv

# Full run with sample region
python main.py --regions moscow --limit 10
```

## Integration with Vercel Cron

### Setup Vercel Cron Job

Create `/api/cron/telegram-scraper.ts` in your Next.js app:

```typescript
import { triggerScraper } from '@/workers/telegram-scraper-wrapper';

export const runtime = 'nodejs';

export default async function handler(req: NextRequest) {
  // Verify Cron secret
  if (req.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await triggerScraper({
      regions: 'all',
      limit: 100,
    });
    
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: 'Scraper failed', details: error },
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

This runs the scraper every 6 hours.

## Architecture

### Components

```
telegram_scraper/
├── main.py              # CLI entry point and orchestration
├── config.py            # Environment variable loading & validation
├── models.py            # Data models (Vacancy, ParsedMessage)
├── parser.py            # Message parsing and field extraction
├── scraper.py           # Telethon-based Telegram scraper
├── kv_store.py          # Vercel KV integration
├── requirements.txt     # Python dependencies
└── tests/
    ├── test_parsing.py  # Parser and model tests
    └── test_kv_store.py # KV store tests
```

### Data Flow

1. **Configuration** → `config.py` loads env vars and validates
2. **Connection** → `scraper.py` connects to Telegram via Telethon
3. **Fetching** → Retrieves messages from configured channels
4. **Parsing** → `parser.py` extracts vacancy metadata
5. **Deduplication** → Checks against `last_seen_id` in KV
6. **Storage** → Stores normalized vacancies in KV with TTL
7. **Tracking** → Updates `last_seen_id` for next run

## Message Parsing

### Supported Regions (Auto-detection)

- Moscow (мск, москва)
- St. Petersburg (спб, санкт-петербург)
- Ekaterinburg (екатеринбург)
- Novosibirsk (новосибирск)
- Kazan (казань)
- Sochi (сочи)
- Krasnoyarsk (красноярск)
- Samara (самара)
- Omsk (омск)
- Krasnodar (краснодар)
- Remote/Online (удалено, remote, online)

### Supported Salary Formats

- Russian: "150000 ₽", "200тыс", "зарплата: 150-200к"
- English: "$5000", "5000 USD", "salary: $5k"
- Formats with ranges: "150000-200000"

### Text Normalization

- Removes excessive whitespace and newlines
- Extracts first meaningful line as title (default 200 chars)
- Cleans text while preserving structure
- Handles emoji and special characters

## Troubleshooting

### "Telethon session" errors

- **Issue**: "Session not found" or authentication errors
- **Fix**: Delete session file and re-authenticate
```bash
rm $TELETHON_SESSION
python main.py --regions moscow --dry-run
# Follow authentication prompts
```

### KV connection fails

- **Issue**: "KV_REST_API_URL or KV_REST_API_TOKEN not set"
- **Fix**: Verify environment variables are set correctly
```bash
echo $KV_REST_API_URL
echo $KV_REST_API_TOKEN  # Should be masked output
```

### No messages found

- **Issue**: Scraper returns empty vacancies list
- **Possible causes**:
  - Channel doesn't exist or is inaccessible
  - User account doesn't have access to channel
  - No new messages since last run
- **Debug**: Run with `--dry-run` and check logs

### Proxy issues

- **Issue**: Connection timeout with proxy enabled
- **Fix**: Verify proxy is accessible and format is correct
```bash
# Test format: socks5://ip:port or http://ip:port
curl -x socks5://your-proxy:port http://example.com
```

## Testing Message Parsing

The test suite includes comprehensive examples of Telegram message parsing:

```bash
# Run parsing tests
pytest tests/test_parsing.py -v

# Test output shows:
# - Russian salary format detection
# - English salary format detection  
# - Region auto-detection (Moscow, SPB, Remote, etc)
# - Title extraction from multiline messages
# - Text normalization
```

See `tests/test_parsing.py` for full examples of supported message formats.

## Performance Considerations

- **Message limit**: Default 100 per channel per run (adjustable with `--limit`)
- **TTL**: Default 5 hours (18000 seconds) - recommended 4-6 hours per spec
- **Cron frequency**: Run every 4-6 hours to maintain fresh data
- **Deduplication**: Eliminates redundant processing via `last_seen_id`

## API Integration

See `../telegram-scraper-wrapper/` for Node.js wrapper and API endpoint handlers that can be integrated with Next.js API routes or Vercel Functions.

## License

MIT
