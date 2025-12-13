#!/usr/bin/env python3
"""CLI entry point for Telegram vacancy scraper."""

import argparse
import asyncio
import json
import logging
import sys
from pathlib import Path

from config import load_telegram_config, load_kv_config, load_region_channel_map
from scraper import TelegramScraper
from kv_store import VercelKVStore


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


async def main():
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Telegram vacancy scraper",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python main.py --regions moscow,spb
  python main.py --regions all
  python main.py --regions moscow --limit 50
  python main.py --regions moscow,spb --output results.json
        """,
    )

    parser.add_argument(
        "--regions",
        type=str,
        default="all",
        help="Comma-separated list of regions to scrape (or 'all')",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=100,
        help="Number of recent messages to fetch per channel (default: 100)",
    )
    parser.add_argument(
        "--output",
        type=str,
        help="Output JSON file (optional, defaults to stdout)",
    )
    parser.add_argument(
        "--skip-kv",
        action="store_true",
        help="Skip storing results in Vercel KV",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Fetch messages but don't store in KV",
    )

    args = parser.parse_args()

    try:
        # Load configuration
        logger.info("Loading configuration...")
        telegram_config = load_telegram_config()
        kv_config = load_kv_config()
        region_map = load_region_channel_map()

        # Determine regions to process
        if args.regions.lower() == "all":
            regions_to_process = region_map.channels
        else:
            requested_regions = [r.strip() for r in args.regions.split(",")]
            regions_to_process = {
                r: region_map.channels[r]
                for r in requested_regions
                if r in region_map.channels
            }
            if not regions_to_process:
                logger.error(
                    f"No valid regions found. Available: "
                    f"{', '.join(region_map.channels.keys())}"
                )
                sys.exit(1)

        logger.info(f"Processing regions: {', '.join(regions_to_process.keys())}")

        # Initialize KV store
        kv_store = VercelKVStore(
            rest_api_url=kv_config.rest_api_url,
            rest_api_token=kv_config.rest_api_token,
            ttl_seconds=kv_config.ttl_seconds,
        )

        # Initialize and run scraper
        scraper = TelegramScraper(telegram_config, kv_store)

        try:
            await scraper.connect()
            logger.info("Starting scrape operation...")
            results = await scraper.scrape_regions(regions_to_process)

            # Store results in KV if not skipped
            if not args.skip_kv and not args.dry_run:
                logger.info("Storing results in Vercel KV...")
                for region, vacancies in results.items():
                    try:
                        if vacancies:
                            kv_store.set_vacancy_batch(region, vacancies)
                            logger.info(
                                f"Stored {len(vacancies)} vacancies for {region}"
                            )
                    except Exception as e:
                        logger.error(f"Failed to store {region}: {e}")

            # Output results
            output_data = {
                "status": "success",
                "timestamp": None,
                "regions_processed": list(regions_to_process.keys()),
                "results": results,
                "total_vacancies": sum(len(v) for v in results.values()),
            }

            if args.output:
                output_path = Path(args.output)
                output_path.parent.mkdir(parents=True, exist_ok=True)
                with open(output_path, "w", encoding="utf-8") as f:
                    json.dump(output_data, f, ensure_ascii=False, indent=2)
                logger.info(f"Results saved to {args.output}")
            else:
                print(json.dumps(output_data, ensure_ascii=False, indent=2))

            logger.info("Scrape operation completed successfully")

        finally:
            await scraper.disconnect()

    except KeyError as e:
        logger.error(f"Configuration error: {e}")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
