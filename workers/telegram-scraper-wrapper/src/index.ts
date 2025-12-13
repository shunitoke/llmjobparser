/**
 * Telegram scraper wrapper - handles triggering Python scraper from Node.js
 */

import { spawn } from 'child_process';
import { resolve } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, '..');

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
export async function triggerScraper(options: ScrapeOptions = {}): Promise<ScrapeResult> {
  return new Promise((resolve) => {
    const pythonScriptPath = resolve(
      __dirname,
      '..',
      '..',
      'telegram_scraper',
      'main.py'
    );

    const args: string[] = [];

    if (options.regions) {
      args.push(`--regions=${options.regions}`);
    }

    if (options.limit) {
      args.push(`--limit=${options.limit}`);
    }

    if (options.skipKv) {
      args.push('--skip-kv');
    }

    if (options.dryRun) {
      args.push('--dry-run');
    }

    const subprocess = spawn('python3', [pythonScriptPath, ...args], {
      env: {
        ...process.env,
        PYTHONUNBUFFERED: '1',
      },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    subprocess.stdout?.on('data', (data) => {
      stdout += data.toString();
      console.log(`[SCRAPER] ${data.toString()}`);
    });

    subprocess.stderr?.on('data', (data) => {
      stderr += data.toString();
      console.error(`[SCRAPER ERROR] ${data.toString()}`);
    });

    subprocess.on('close', (code) => {
      if (code === 0) {
        try {
          const data = JSON.parse(stdout);
          resolve({
            success: true,
            message: 'Scraper completed successfully',
            data,
          });
        } catch {
          resolve({
            success: true,
            message: 'Scraper completed successfully (output not JSON)',
            data: { raw_output: stdout },
          });
        }
      } else {
        resolve({
          success: false,
          message: `Scraper failed with exit code ${code}`,
          error: stderr || stdout,
        });
      }
    });

    subprocess.on('error', (error) => {
      resolve({
        success: false,
        message: 'Failed to start scraper process',
        error: error.message,
      });
    });
  });
}

/**
 * Trigger scraper for specific regions
 */
export async function scrapeRegions(
  regions: string | string[],
  options: Omit<ScrapeOptions, 'regions'> = {}
): Promise<ScrapeResult> {
  const regionString = Array.isArray(regions) ? regions.join(',') : regions;
  return triggerScraper({ ...options, regions: regionString });
}

/**
 * Trigger full scrape of all configured regions
 */
export async function scrapeAll(
  options: Omit<ScrapeOptions, 'regions'> = {}
): Promise<ScrapeResult> {
  return triggerScraper({ ...options, regions: 'all' });
}
