"""Message parsing and vacancy extraction logic."""

import re
from typing import Optional, Tuple
from models import Vacancy, ParsedMessage
from datetime import datetime


class VacancyParser:
    """Parses Telegram messages to extract job vacancy information."""

    # Regex patterns for common field extraction
    PAY_PATTERNS = [
        r"(?:зарплата|оклад|з\.п\.|з/п|доход|earnings|salary|wage)[\s:]+([₽$€\d\s\-]+\d+)",
        r"([₽$€]\s*[\d\s\-]+)",
        r"(\d+\s*(?:тыс|k|K)?[\s]*(?:₽|р|руб|rub|\$|€))",
    ]

    REGION_PATTERNS = {
        # Russian regions
        "moscow": r"(?:Москв|мск|МСК|moscow)",
        "spb": r"(?:Санкт-Петербург|СПб|spb|SPB|saint petersburg)",
        "ekaterinburg": r"(?:Екатеринбург|Свердловская|ekaterinburg)",
        "novosibirsk": r"(?:Новосибирск|novosibirsk)",
        "kazan": r"(?:Казань|kazan)",
        "sochi": r"(?:Сочи|sochi)",
        "krasnoyarsk": r"(?:Красноярск|krasnoyarsk)",
        "samara": r"(?:Самара|samara)",
        "omsk": r"(?:Омск|omsk)",
        "krasnodar": r"(?:Краснодар|krasnodar)",
        "remote": r"(?:удалено|remote|online|онлайн)",
    }

    def __init__(self):
        """Initialize the parser with compiled regex patterns."""
        self.pay_compiled = [re.compile(p, re.IGNORECASE) for p in self.PAY_PATTERNS]
        self.region_compiled = {
            region: re.compile(pattern, re.IGNORECASE)
            for region, pattern in self.REGION_PATTERNS.items()
        }

    def extract_pay(self, text: str) -> Optional[str]:
        """Extract payment information from text."""
        for pattern in self.pay_compiled:
            match = pattern.search(text)
            if match:
                pay = match.group(1).strip()
                if pay:
                    return pay
        return None

    def extract_region(self, text: str) -> Optional[str]:
        """Extract region information from text."""
        for region, pattern in self.region_compiled.items():
            if pattern.search(text):
                return region
        return None

    def extract_title(self, text: str, max_length: int = 200) -> str:
        """Extract title from message (first meaningful line or first sentence)."""
        lines = text.split("\n")
        for line in lines:
            cleaned = line.strip()
            if cleaned and len(cleaned) > 5:
                if len(cleaned) > max_length:
                    return cleaned[:max_length]
                return cleaned
        # Fallback: first max_length characters
        return text[:max_length].strip()

    def normalize_text(self, text: str) -> str:
        """Normalize and clean message text."""
        # Remove excessive whitespace
        text = re.sub(r"\s+", " ", text)
        # Remove common spam/emoji patterns
        text = re.sub(r"[^\w\s\-.,!?@#$%₽€\$():/\n]", "", text, flags=re.UNICODE)
        return text.strip()

    def parse_message(
        self, parsed_msg: ParsedMessage, region: str
    ) -> Optional[Vacancy]:
        """Parse a Telegram message into a Vacancy object."""
        if not parsed_msg.text:
            return None

        normalized_text = self.normalize_text(parsed_msg.text)
        if not normalized_text:
            return None

        title = self.extract_title(normalized_text)
        pay = self.extract_pay(normalized_text)
        detected_region = self.extract_region(normalized_text)

        # Use provided region if not detected
        final_region = detected_region or region or "unknown"

        vacancy = Vacancy(
            title=title,
            body=normalized_text,
            region=final_region,
            posted_at=parsed_msg.posted_at.isoformat(),
            message_id=parsed_msg.message_id,
            source_channel=parsed_msg.channel_username,
            pay=pay,
        )

        return vacancy
