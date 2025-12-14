/**
 * Telegram scraper wrapper - handles triggering Python scraper from Node.js
 */
interface ScrapeOptions {
    regions?: string;
    limit?: number;
    skipKv?: boolean;
    dryRun?: boolean;
}
interface ScrapeResult {
    success: boolean;
    message: string;
    data?: Record<string, unknown>;
    error?: string;
}
/**
 * Trigger the Python Telegram scraper
 */
export declare function triggerScraper(options?: ScrapeOptions): Promise<ScrapeResult>;
/**
 * Trigger scraper for specific regions
 */
export declare function scrapeRegions(regions: string | string[], options?: Omit<ScrapeOptions, 'regions'>): Promise<ScrapeResult>;
/**
 * Trigger full scrape of all configured regions
 */
export declare function scrapeAll(options?: Omit<ScrapeOptions, 'regions'>): Promise<ScrapeResult>;
export {};
