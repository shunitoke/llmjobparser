/**
 * API endpoint handler for triggering Telegram scraper
 * Can be used as a Vercel Function or integrated into Next.js API routes
 */
import { scrapeRegions, scrapeAll } from './index';
/**
 * Main API handler for scraper triggers
 */
export async function handler(req) {
    // Only accept POST requests
    if (req.method !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method not allowed' }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
    try {
        const body = req.body || {};
        const action = body.action || 'scrape';
        const regions = body.regions;
        const limit = body.limit;
        const skipKv = body.skip_kv === true;
        const dryRun = body.dry_run === true;
        let result;
        switch (action) {
            case 'scrape-all':
                result = await scrapeAll({ limit, skipKv, dryRun });
                break;
            case 'scrape-regions':
                if (!regions) {
                    return {
                        statusCode: 400,
                        body: JSON.stringify({
                            error: 'regions parameter is required for scrape-regions action',
                        }),
                        headers: { 'Content-Type': 'application/json' },
                    };
                }
                result = await scrapeRegions(regions, { limit, skipKv, dryRun });
                break;
            case 'scrape':
            default:
                // Default: scrape specified regions or all
                if (regions) {
                    result = await scrapeRegions(regions, { limit, skipKv, dryRun });
                }
                else {
                    result = await scrapeAll({ limit, skipKv, dryRun });
                }
                break;
        }
        return {
            statusCode: result.success ? 200 : 500,
            body: JSON.stringify(result),
            headers: { 'Content-Type': 'application/json' },
        };
    }
    catch (error) {
        console.error('Handler error:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error instanceof Error ? error.message : 'Unknown error',
            }),
            headers: { 'Content-Type': 'application/json' },
        };
    }
}
/**
 * Vercel Function wrapper
 */
export default handler;
