#!/bin/bash

# Test the cron notification endpoint locally
# Usage: ./scripts/test-cron.sh

CRON_SECRET=${CRON_SECRET:-"test-secret"}
URL=${1:-"http://localhost:3000/api/cron/notifications"}

echo "Testing cron endpoint: $URL"
echo "Using CRON_SECRET: $CRON_SECRET"
echo ""

curl -X POST "$URL" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -w "\n\nHTTP Status: %{http_code}\n"
