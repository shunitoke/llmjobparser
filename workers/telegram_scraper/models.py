"""Data models for vacancy extraction from Telegram messages."""

from dataclasses import dataclass, asdict
from datetime import datetime
from typing import Optional
import json


@dataclass
class Vacancy:
    """Normalized job vacancy extracted from Telegram message."""

    title: str
    body: str
    region: str
    posted_at: str  # ISO 8601 format
    message_id: int
    source_channel: str
    pay: Optional[str] = None
    url: Optional[str] = None

    def to_dict(self) -> dict:
        """Convert vacancy to dictionary."""
        return asdict(self)

    def to_json(self) -> str:
        """Convert vacancy to JSON string."""
        return json.dumps(self.to_dict(), ensure_ascii=False)

    @staticmethod
    def from_dict(data: dict) -> "Vacancy":
        """Create vacancy from dictionary."""
        return Vacancy(**data)


@dataclass
class ParsedMessage:
    """Raw parsed message from Telegram with metadata."""

    message_id: int
    text: str
    channel_username: str
    posted_at: datetime
    grouped_id: Optional[int] = None

    def to_dict(self) -> dict:
        """Convert to dictionary."""
        return {
            "message_id": self.message_id,
            "text": self.text,
            "channel_username": self.channel_username,
            "posted_at": self.posted_at.isoformat(),
            "grouped_id": self.grouped_id,
        }
