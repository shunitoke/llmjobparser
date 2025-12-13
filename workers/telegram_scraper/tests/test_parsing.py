"""Tests for message parsing and vacancy extraction."""

import pytest
from datetime import datetime
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from parser import VacancyParser
from models import ParsedMessage, Vacancy


class TestVacancyParser:
    """Test VacancyParser functionality."""

    @pytest.fixture
    def parser(self):
        """Create parser instance."""
        return VacancyParser()

    def test_extract_pay_russian_format(self, parser):
        """Test extraction of Russian salary formats."""
        text = "Вакансия: разработчик Python. Зарплата: 150000-200000 ₽"
        pay = parser.extract_pay(text)
        assert pay is not None
        assert "150000" in pay or "200000" in pay or "150000-200000" in pay

    def test_extract_pay_english_format(self, parser):
        """Test extraction of English salary formats."""
        text = "Python Developer. Salary: $5000-7000 per month"
        pay = parser.extract_pay(text)
        assert pay is not None
        assert "$" in pay

    def test_extract_pay_no_match(self, parser):
        """Test when no salary information is present."""
        text = "Looking for a developer with 5 years experience"
        pay = parser.extract_pay(text)
        assert pay is None

    def test_extract_region_moscow(self, parser):
        """Test detection of Moscow region."""
        text = "Разработчик в Москву. ЗП: 200к"
        region = parser.extract_region(text)
        assert region == "moscow"

    def test_extract_region_spb(self, parser):
        """Test detection of St. Petersburg region."""
        text = "Вакансия в Санкт-Петербурге"
        region = parser.extract_region(text)
        assert region == "spb"

    def test_extract_region_remote(self, parser):
        """Test detection of remote region."""
        text = "Remote position, work from home"
        region = parser.extract_region(text)
        assert region == "remote"

    def test_extract_region_no_match(self, parser):
        """Test when region is not detected."""
        text = "Looking for experienced developer"
        region = parser.extract_region(text)
        assert region is None

    def test_extract_title_multiline(self, parser):
        """Test title extraction from multiline text."""
        text = """Вакансия: Junior Python Developer
        
Компания: Tech Corp
Опыт: 1-3 года"""
        title = parser.extract_title(text)
        assert "Python Developer" in title
        assert "\n" not in title

    def test_extract_title_single_line(self, parser):
        """Test title extraction from single line."""
        text = "Senior Java Developer needed"
        title = parser.extract_title(text)
        assert "Senior Java Developer" in title

    def test_extract_title_long_text(self, parser):
        """Test title truncation for long text."""
        long_text = "A" * 500
        title = parser.extract_title(long_text, max_length=200)
        assert len(title) <= 200

    def test_normalize_text_removes_whitespace(self, parser):
        """Test normalization removes excessive whitespace."""
        text = "Hello    \n\n   World"
        normalized = parser.normalize_text(text)
        assert "    " not in normalized
        assert "\n" not in normalized

    def test_parse_message_complete(self, parser):
        """Test complete message parsing."""
        msg = ParsedMessage(
            message_id=123,
            text="Вакансия: Python Developer, Москва, Зарплата: 180000 ₽",
            channel_username="@jobs_channel",
            posted_at=datetime.now(),
        )

        vacancy = parser.parse_message(msg, "moscow")

        assert vacancy is not None
        assert vacancy.message_id == 123
        assert vacancy.source_channel == "@jobs_channel"
        assert vacancy.region in ["moscow", "unknown"]
        assert "Python" in vacancy.title

    def test_parse_message_empty_text(self, parser):
        """Test parsing message with empty text."""
        msg = ParsedMessage(
            message_id=123,
            text="",
            channel_username="@channel",
            posted_at=datetime.now(),
        )

        vacancy = parser.parse_message(msg, "moscow")
        assert vacancy is None

    def test_parse_message_invalid_text(self, parser):
        """Test parsing message with only whitespace."""
        msg = ParsedMessage(
            message_id=123,
            text="   \n\n   ",
            channel_username="@channel",
            posted_at=datetime.now(),
        )

        vacancy = parser.parse_message(msg, "moscow")
        assert vacancy is None

    def test_vacancy_to_dict(self):
        """Test vacancy conversion to dictionary."""
        vacancy = Vacancy(
            title="Developer",
            body="Full body text",
            region="moscow",
            posted_at="2024-01-01T10:00:00",
            message_id=123,
            source_channel="@channel",
            pay="200000 ₽",
        )

        vacancy_dict = vacancy.to_dict()
        assert vacancy_dict["title"] == "Developer"
        assert vacancy_dict["message_id"] == 123
        assert vacancy_dict["pay"] == "200000 ₽"

    def test_vacancy_to_json(self):
        """Test vacancy conversion to JSON."""
        vacancy = Vacancy(
            title="Developer",
            body="Full body text",
            region="moscow",
            posted_at="2024-01-01T10:00:00",
            message_id=123,
            source_channel="@channel",
        )

        json_str = vacancy.to_json()
        assert isinstance(json_str, str)
        assert "Developer" in json_str
        assert "123" in json_str

    def test_vacancy_from_dict(self):
        """Test vacancy creation from dictionary."""
        data = {
            "title": "Developer",
            "body": "Full body text",
            "region": "moscow",
            "posted_at": "2024-01-01T10:00:00",
            "message_id": 123,
            "source_channel": "@channel",
            "pay": None,
            "url": None,
        }

        vacancy = Vacancy.from_dict(data)
        assert vacancy.title == "Developer"
        assert vacancy.message_id == 123


class TestParsedMessage:
    """Test ParsedMessage model."""

    def test_parsed_message_creation(self):
        """Test ParsedMessage creation."""
        now = datetime.now()
        msg = ParsedMessage(
            message_id=456,
            text="Test message",
            channel_username="@test",
            posted_at=now,
        )

        assert msg.message_id == 456
        assert msg.text == "Test message"
        assert msg.channel_username == "@test"
        assert msg.posted_at == now

    def test_parsed_message_to_dict(self):
        """Test ParsedMessage to dictionary conversion."""
        now = datetime.now()
        msg = ParsedMessage(
            message_id=456,
            text="Test message",
            channel_username="@test",
            posted_at=now,
        )

        msg_dict = msg.to_dict()
        assert msg_dict["message_id"] == 456
        assert msg_dict["text"] == "Test message"
        assert "posted_at" in msg_dict
