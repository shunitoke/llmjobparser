/**
 * API endpoint handler for triggering Telegram scraper
 * Can be used as a Vercel Function or integrated into Next.js API routes
 */
interface ApiRequest {
    method?: string;
    query?: Record<string, string | string[]>;
    body?: Record<string, unknown>;
}
interface ApiResponse {
    statusCode: number;
    body: string;
    headers?: Record<string, string>;
}
/**
 * Main API handler for scraper triggers
 */
export declare function handler(req: ApiRequest): Promise<ApiResponse>;
/**
 * Vercel Function wrapper
 */
export default handler;
