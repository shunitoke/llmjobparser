# Search API Documentation

## Overview

The Search API implements the core search flow for job vacancy search with LLM-powered parsing and scoring capabilities.

## Endpoint

`POST /api/search`

## Request Format

```json
{
  "prompt": "Looking for backend engineer position",
  "regions": ["Remote", "Europe"],
  "categories": ["Software Engineering"],
  "includePrivate": false
}
```

### Fields

- `prompt` (string, required): Search query (min 5, max 2000 characters)
- `regions` (array of strings, optional): List of regions to search in
- `categories` (array of strings, optional): List of job categories
- `includePrivate` (boolean, optional): Whether to include private scrapers

## Response Format

```json
{
  "items": [
    {
      "id": "job-123",
      "title": "Backend Engineer",
      "company": "Tech Corp",
      "location": "Remote",
      "summary": "Great opportunity...",
      "badges": ["Highly Relevant", "Remote-Friendly"]
    }
  ],
  "batchStatus": {
    "vacancies:public:abc123": {
      "pending": false,
      "refreshTriggered": false
    }
  }
}
```

### Response Fields

- `items`: Array of job vacancies with LLM-generated badge scores
- `batchStatus`: Object showing the status of each vacancy batch
  - `pending`: Whether the batch is still being fetched
  - `refreshTriggered`: Whether a refresh was triggered for this batch

## Architecture

### 1. Prompt Parsing

The API hashes the incoming prompt and checks Vercel KV for cached parsed data:

- Cache key: `parsed_prompt:{sha256(prompt)}`
- TTL: 3600 seconds (1 hour)

If not cached, it calls OpenRouter LLM to extract:

- Keywords from the prompt
- Desired schedule (full-time, part-time, contract, etc.)

### 2. Vacancy Retrieval

For each region and source combination:

- Cache key: `vacancies:{source}:{region_hash}`
- Checks if batch exists and is fresh (< 1 hour old)
- If missing/stale: enqueues fetch request to scraper worker and returns `pending: true`

### 3. LLM Scoring

Vacancies are scored in batches of 15-20 using OpenRouter LLM:

- Each vacancy gets 1-3 badge labels (e.g., "Highly Relevant", "Remote-Friendly")
- Scores are cached per vacancy and prompt combination
- Cache key: `scores:{prompt_hash}:{job_id}`
- TTL: 3600 seconds (1 hour)

### 4. Cache Strategy

- **Prompt parsing**: Shared across all users with same prompt
- **Vacancy batches**: Shared across all searches for the same region/source
- **Scores**: Reused when same prompt is used for same vacancy

## Testing

### Unit Tests

- `src/lib/cache-keys.test.ts`: Tests cache key generation and hashing
- `src/lib/scoring-batcher.test.ts`: Tests batch scoring logic

### Integration Tests

- `src/app/api/search/route.test.ts`: Tests cache hit/miss scenarios with KV mock

Run tests:

```bash
pnpm test
```

## Environment Variables

Required for full functionality:

```env
OPENROUTER_API_KEY=your_key_here
OPENROUTER_BASE_URL=https://openrouter.ai/api/v1
KV_REST_API_URL=your_vercel_kv_url
KV_REST_API_TOKEN=your_vercel_kv_token
```

Without these, the API will use fallback strategies:

- Simple keyword extraction instead of LLM parsing
- Generic "Relevant" badges instead of LLM scoring

## Implementation Files

- `src/app/api/search/route.ts`: Main API route handler
- `src/lib/cache-keys.ts`: Cache key generation utilities
- `src/lib/kv.ts`: Vercel KV client setup
- `src/lib/llm.ts`: OpenRouter LLM client for parsing and scoring
- `src/lib/scoring-batcher.ts`: Batch scoring logic
- `src/lib/scraper-worker.ts`: Scraper worker stub

## Performance Considerations

- Batching LLM calls reduces API costs and latency
- Three-tier caching strategy minimizes redundant LLM calls
- Stale batch detection ensures data freshness
- Fallback to cached scores when available
