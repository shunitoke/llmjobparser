"""Configuration and environment variable loading for Telegram scraper."""

import json
import os
from dataclasses import dataclass
from typing import Optional


@dataclass
class TelegramConfig:
    """Telegram API and session configuration."""

    api_id: int
    api_hash: str
    session_path: str
    proxy_url: Optional[str] = None


@dataclass
class KVConfig:
    """Vercel KV configuration."""

    rest_api_url: str
    rest_api_token: str
    ttl_seconds: int = 18000  # 5 hours default


@dataclass
class RegionChannelMap:
    """Mapping of regions to Telegram channels."""

    channels: dict[str, list[str]]  # region -> list of channel identifiers/usernames


def load_telegram_config() -> TelegramConfig:
    """Load Telegram configuration from environment variables."""
    api_id = os.getenv("TELEGRAM_API_ID")
    api_hash = os.getenv("TELEGRAM_API_HASH")
    session_path = os.getenv("TELETHON_SESSION", "/tmp/telethon_session")
    proxy_url = os.getenv("TELEGRAM_PROXY_URL")

    if not api_id:
        raise ValueError("TELEGRAM_API_ID environment variable is required")
    if not api_hash:
        raise ValueError("TELEGRAM_API_HASH environment variable is required")

    try:
        api_id = int(api_id)
    except ValueError:
        raise ValueError("TELEGRAM_API_ID must be a valid integer")

    return TelegramConfig(
        api_id=api_id,
        api_hash=api_hash,
        session_path=session_path,
        proxy_url=proxy_url,
    )


def load_kv_config() -> KVConfig:
    """Load Vercel KV configuration from environment variables."""
    rest_api_url = os.getenv("KV_REST_API_URL")
    rest_api_token = os.getenv("KV_REST_API_TOKEN")

    if not rest_api_url:
        raise ValueError("KV_REST_API_URL environment variable is required")
    if not rest_api_token:
        raise ValueError("KV_REST_API_TOKEN environment variable is required")

    ttl_str = os.getenv("KV_TTL_SECONDS", "18000")
    try:
        ttl = int(ttl_str)
    except ValueError:
        ttl = 18000

    return KVConfig(
        rest_api_url=rest_api_url,
        rest_api_token=rest_api_token,
        ttl_seconds=ttl,
    )


def load_region_channel_map() -> RegionChannelMap:
    """Load region to channel mapping from environment variable."""
    region_map_json = os.getenv("REGION_CHANNEL_MAP")

    if not region_map_json:
        raise ValueError("REGION_CHANNEL_MAP environment variable is required")

    try:
        channels = json.loads(region_map_json)
    except json.JSONDecodeError:
        raise ValueError(
            "REGION_CHANNEL_MAP must be valid JSON. Expected format: "
            '{"region_name": ["@channel1", "@channel2"]}'
        )

    if not isinstance(channels, dict):
        raise ValueError("REGION_CHANNEL_MAP must be a JSON object")

    for region, channel_list in channels.items():
        if not isinstance(channel_list, list):
            raise ValueError(
                f"Channel list for region '{region}' must be an array"
            )
        for channel in channel_list:
            if not isinstance(channel, str):
                raise ValueError(
                    f"Channel identifier in region '{region}' must be a string"
                )

    return RegionChannelMap(channels=channels)
