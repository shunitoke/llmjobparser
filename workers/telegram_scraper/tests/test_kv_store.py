"""Tests for Vercel KV store integration."""

import pytest
import json
from unittest.mock import Mock, patch, MagicMock
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from kv_store import VercelKVStore


class TestVercelKVStore:
    """Test VercelKVStore functionality."""

    @pytest.fixture
    def kv_store(self):
        """Create KV store instance with mocked requests."""
        return VercelKVStore(
            rest_api_url="https://example.vercel-kv.com",
            rest_api_token="test_token",
            ttl_seconds=18000,
        )

    def test_kv_store_initialization(self, kv_store):
        """Test KV store initialization."""
        assert kv_store.rest_api_url == "https://example.vercel-kv.com"
        assert kv_store.rest_api_token == "test_token"
        assert kv_store.ttl_seconds == 18000

    def test_hash_region(self):
        """Test region hashing."""
        hash1 = VercelKVStore._hash_region("Moscow")
        hash2 = VercelKVStore._hash_region("moscow")
        hash3 = VercelKVStore._hash_region("SPB")

        assert hash1 == hash2  # Case insensitive
        assert hash1 != hash3  # Different regions have different hashes
        assert len(hash1) == 8  # 8 character hash

    @patch("kv_store.requests.Session.post")
    def test_set_vacancy_batch(self, mock_post, kv_store):
        """Test setting vacancy batch in KV store."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"status": "ok"}
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        vacancies = [
            {
                "title": "Developer",
                "body": "Job description",
                "region": "moscow",
                "posted_at": "2024-01-01T10:00:00",
                "message_id": 123,
                "source_channel": "@channel",
            }
        ]

        result = kv_store.set_vacancy_batch("moscow", vacancies)

        assert result is True
        mock_post.assert_called()

    @patch("kv_store.requests.Session.get")
    def test_get_vacancies_not_found(self, mock_get, kv_store):
        """Test getting vacancies when none exist."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"result": None}
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = kv_store.get_vacancies("moscow")
        assert result is None

    @patch("kv_store.requests.Session.post")
    def test_set_last_seen_id(self, mock_post, kv_store):
        """Test setting last seen message ID."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"status": "ok"}
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        result = kv_store.set_last_seen_id("@channel", 12345)

        assert result is True
        mock_post.assert_called()

    @patch("kv_store.requests.Session.get")
    def test_get_last_seen_id(self, mock_get, kv_store):
        """Test getting last seen message ID."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"result": "12345"}
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = kv_store.get_last_seen_id("@channel")

        assert result == 12345

    @patch("kv_store.requests.Session.get")
    def test_get_last_seen_id_integer_value(self, mock_get, kv_store):
        """Test getting last seen ID when stored as integer."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"result": 12345}
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = kv_store.get_last_seen_id("@channel")

        assert result == 12345

    @patch("kv_store.requests.Session.get")
    def test_get_last_seen_id_not_found(self, mock_get, kv_store):
        """Test getting last seen ID when none exists."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"result": None}
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = kv_store.get_last_seen_id("@channel")

        assert result is None

    @patch("kv_store.requests.Session.get")
    def test_get_last_seen_id_invalid_value(self, mock_get, kv_store):
        """Test getting last seen ID with invalid value."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"result": "not_a_number"}
        mock_response.raise_for_status = MagicMock()
        mock_get.return_value = mock_response

        result = kv_store.get_last_seen_id("@channel")

        assert result is None

    def test_set_vacancy_batch_empty_list(self, kv_store):
        """Test setting empty vacancy batch returns True without making request."""
        result = kv_store.set_vacancy_batch("moscow", [])
        assert result is True

    @patch("kv_store.requests.Session.post")
    def test_set_vacancy_batch_with_ttl_override(self, mock_post, kv_store):
        """Test setting vacancy batch with TTL override."""
        mock_response = MagicMock()
        mock_response.json.return_value = {"status": "ok"}
        mock_response.raise_for_status = MagicMock()
        mock_post.return_value = mock_response

        vacancies = [
            {
                "title": "Developer",
                "body": "Job description",
                "region": "moscow",
                "posted_at": "2024-01-01T10:00:00",
                "message_id": 123,
                "source_channel": "@channel",
            }
        ]

        result = kv_store.set_vacancy_batch("moscow", vacancies, ttl=3600)

        assert result is True
        # Verify the TTL was used in the request
        call_args = mock_post.call_args
        assert call_args is not None
