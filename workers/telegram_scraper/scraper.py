"""Telegram scraper using Telethon library."""

import asyncio
import logging
from typing import Optional, List
from datetime import datetime, timezone
from telethon import TelegramClient
from telethon.sessions import StringSession
from telethon.types import Message, Channel

from config import TelegramConfig
from models import ParsedMessage, Vacancy
from parser import VacancyParser
from kv_store import VercelKVStore


logger = logging.getLogger(__name__)


class TelegramScraper:
    """Scrapes job vacancy messages from Telegram channels using Telethon."""

    def __init__(
        self,
        telegram_config: TelegramConfig,
        kv_store: VercelKVStore,
    ):
        """Initialize the scraper.
        
        Args:
            telegram_config: Telegram API configuration
            kv_store: KV store for persistence
        """
        self.config = telegram_config
        self.kv_store = kv_store
        self.parser = VacancyParser()
        self.client: Optional[TelegramClient] = None
        self.session_string: Optional[str] = None

    async def connect(self) -> None:
        """Establish connection to Telegram."""
        try:
            # Try to load existing session from file
            session_string = None
            try:
                with open(self.config.session_path, "r") as f:
                    session_string = f.read().strip()
            except FileNotFoundError:
                logger.info("No existing session found, will create new one")

            session = (
                StringSession(session_string)
                if session_string
                else self.config.session_path
            )

            self.client = TelegramClient(
                session,
                self.config.api_id,
                self.config.api_hash,
                proxy=self._get_proxy_settings(),
            )

            await self.client.start()
            
            # Save session if using StringSession
            if isinstance(session, StringSession):
                self.session_string = self.client.session.save()
                with open(self.config.session_path, "w") as f:
                    f.write(self.session_string)

            logger.info("Connected to Telegram")
        except Exception as e:
            logger.error(f"Failed to connect to Telegram: {e}")
            raise

    async def disconnect(self) -> None:
        """Close Telegram connection."""
        if self.client:
            await self.client.disconnect()
            logger.info("Disconnected from Telegram")

    def _get_proxy_settings(self) -> Optional[tuple]:
        """Parse proxy settings if configured."""
        if not self.config.proxy_url:
            return None

        # Expected format: socks5://ip:port or http://ip:port
        try:
            from urllib.parse import urlparse

            parsed = urlparse(self.config.proxy_url)
            proxy_type = parsed.scheme.lower()
            
            if proxy_type == "socks5":
                return ("socks5", parsed.hostname, parsed.port)
            elif proxy_type == "http":
                return ("http", parsed.hostname, parsed.port)
            else:
                logger.warning(f"Unsupported proxy type: {proxy_type}")
                return None
        except Exception as e:
            logger.warning(f"Failed to parse proxy settings: {e}")
            return None

    async def fetch_messages(
        self,
        channel_identifier: str,
        region: str,
        limit: int = 100,
    ) -> List[Vacancy]:
        """Fetch and parse messages from a channel.
        
        Args:
            channel_identifier: Channel username (with @) or ID
            region: Region identifier for messages from this channel
            limit: Number of recent messages to fetch
        
        Returns:
            List of parsed vacancies
        """
        if not self.client:
            raise RuntimeError("Client not connected. Call connect() first.")

        vacancies = []
        last_seen_id = self.kv_store.get_last_seen_id(channel_identifier)

        try:
            # Get the channel
            channel = await self.client.get_entity(channel_identifier)
            if not isinstance(channel, Channel):
                logger.warning(f"{channel_identifier} is not a channel, skipping")
                return vacancies

            logger.info(
                f"Fetching messages from {channel_identifier} "
                f"(last_seen: {last_seen_id})"
            )

            # Fetch recent messages
            messages = []
            async for message in self.client.iter_messages(channel, limit=limit):
                if last_seen_id and message.id <= last_seen_id:
                    break
                if message.text:
                    messages.append(message)

            logger.info(f"Fetched {len(messages)} messages from {channel_identifier}")

            # Process messages
            new_max_id = last_seen_id or 0
            for message in messages:
                try:
                    parsed = await self._parse_telegram_message(
                        message, channel_identifier, region
                    )
                    if parsed:
                        vacancies.append(parsed)
                        new_max_id = max(new_max_id, message.id)
                except Exception as e:
                    logger.error(f"Error parsing message {message.id}: {e}")
                    continue

            # Update last seen ID
            if new_max_id > (last_seen_id or 0):
                try:
                    self.kv_store.set_last_seen_id(channel_identifier, new_max_id)
                except Exception as e:
                    logger.error(f"Failed to update last_seen_id: {e}")

        except Exception as e:
            logger.error(f"Error fetching from {channel_identifier}: {e}")

        return vacancies

    async def _parse_telegram_message(
        self, message: Message, channel_username: str, region: str
    ) -> Optional[Vacancy]:
        """Parse a single Telegram message into a Vacancy.
        
        Args:
            message: Telethon Message object
            channel_username: Channel identifier
            region: Region identifier
        
        Returns:
            Parsed Vacancy or None if parsing fails
        """
        if not message.text:
            return None

        parsed_msg = ParsedMessage(
            message_id=message.id,
            text=message.text,
            channel_username=channel_username,
            posted_at=message.date or datetime.now(timezone.utc),
            grouped_id=getattr(message, "grouped_id", None),
        )

        vacancy = self.parser.parse_message(parsed_msg, region)
        return vacancy

    async def scrape_regions(
        self, region_channels: dict[str, list[str]]
    ) -> dict[str, list[dict]]:
        """Scrape multiple regions and channels.
        
        Args:
            region_channels: Mapping of region to list of channel identifiers
        
        Returns:
            Dictionary mapping regions to lists of vacancy dictionaries
        """
        results = {}

        for region, channels in region_channels.items():
            region_vacancies = []
            logger.info(f"Processing region: {region}")

            for channel in channels:
                try:
                    vacancies = await self.fetch_messages(channel, region, limit=100)
                    region_vacancies.extend([v.to_dict() for v in vacancies])
                    logger.info(
                        f"Region {region}, Channel {channel}: "
                        f"found {len(vacancies)} vacancies"
                    )
                except Exception as e:
                    logger.error(f"Error processing {channel}: {e}")
                    continue

            results[region] = region_vacancies
            logger.info(
                f"Region {region} complete: {len(region_vacancies)} total vacancies"
            )

        return results
