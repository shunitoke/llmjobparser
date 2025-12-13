"""Vercel KV store integration for vacancy and state persistence."""

import json
import hashlib
from typing import Optional, Any
import requests
from datetime import datetime, timedelta, timezone


class VercelKVStore:
    """Interface to Vercel KV for storing vacancies and tracking state."""

    def __init__(self, rest_api_url: str, rest_api_token: str, ttl_seconds: int = 18000):
        """Initialize KV store connection.
        
        Args:
            rest_api_url: Vercel KV REST API URL
            rest_api_token: Vercel KV REST API token
            ttl_seconds: Time to live for vacancy records (default 5 hours)
        """
        self.rest_api_url = rest_api_url.rstrip("/")
        self.rest_api_token = rest_api_token
        self.ttl_seconds = ttl_seconds
        self.session = requests.Session()
        self.session.headers.update({
            "Authorization": f"Bearer {rest_api_token}",
            "Content-Type": "application/json",
        })

    def _make_request(
        self, method: str, path: str, data: Optional[dict] = None, params: Optional[dict] = None
    ) -> dict:
        """Make HTTP request to KV store."""
        url = f"{self.rest_api_url}/{path.lstrip('/')}"
        
        try:
            if method.upper() == "GET":
                response = self.session.get(url, params=params, timeout=10)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data, params=params, timeout=10)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
            
            response.raise_for_status()
            return response.json() if response.text else {}
        except requests.RequestException as e:
            raise RuntimeError(f"KV store request failed: {e}")

    def set_vacancy_batch(self, region: str, vacancies: list[dict], ttl: Optional[int] = None) -> bool:
        """Store a batch of vacancies for a region with TTL.
        
        Args:
            region: Region identifier
            vacancies: List of vacancy dictionaries
            ttl: Optional TTL override in seconds
        
        Returns:
            True if successful
        """
        if not vacancies:
            return True

        ttl = ttl or self.ttl_seconds
        region_hash = self._hash_region(region)
        key = f"vacancies:telegram:{region_hash}"

        now = datetime.now(timezone.utc)
        data = {
            "region": region,
            "count": len(vacancies),
            "vacancies": vacancies,
            "updated_at": now.isoformat(),
            "expires_at": (now + timedelta(seconds=ttl)).isoformat(),
        }

        try:
            # Vercel KV via REST API - set command
            response = self.session.post(
                f"{self.rest_api_url}/set",
                json={"key": key, "value": json.dumps(data), "ex": ttl},
                timeout=10
            )
            response.raise_for_status()
            return True
        except Exception:
            # Fallback: try mset
            try:
                response = self.session.post(
                    f"{self.rest_api_url}/mset",
                    json={key: json.dumps(data), "EX": ttl},
                    timeout=10
                )
                response.raise_for_status()
                return True
            except Exception as e:
                raise RuntimeError(f"Failed to store vacancies for region {region}: {e}")

    def get_vacancies(self, region: str) -> Optional[dict]:
        """Retrieve stored vacancies for a region.
        
        Args:
            region: Region identifier
        
        Returns:
            Stored vacancy data or None if not found
        """
        region_hash = self._hash_region(region)
        key = f"vacancies:telegram:{region_hash}"

        try:
            response = self.session.get(
                f"{self.rest_api_url}/get",
                params={"key": key},
                timeout=10
            )
            response.raise_for_status()
            result = response.json()
            
            if result and "result" in result:
                value = result["result"]
                if isinstance(value, str):
                    return json.loads(value)
                return value
            return None
        except Exception:
            return None

    def get_last_seen_id(self, channel: str) -> Optional[int]:
        """Get the last seen message ID for a channel.
        
        Args:
            channel: Channel identifier/username
        
        Returns:
            Last seen message ID or None
        """
        key = f"telegram:last_seen:{channel}"
        
        try:
            response = self.session.get(
                f"{self.rest_api_url}/get",
                params={"key": key},
                timeout=10
            )
            response.raise_for_status()
            result = response.json()
            
            if result and "result" in result:
                value = result["result"]
                if isinstance(value, str):
                    try:
                        return int(value)
                    except (ValueError, TypeError):
                        return None
                elif isinstance(value, int):
                    return value
            return None
        except Exception:
            return None

    def set_last_seen_id(self, channel: str, message_id: int) -> bool:
        """Store the last seen message ID for a channel.
        
        Args:
            channel: Channel identifier/username
            message_id: Message ID to store
        
        Returns:
            True if successful
        """
        key = f"telegram:last_seen:{channel}"
        
        try:
            response = self.session.post(
                f"{self.rest_api_url}/set",
                json={"key": key, "value": str(message_id)},
                timeout=10
            )
            response.raise_for_status()
            return True
        except Exception as e:
            raise RuntimeError(f"Failed to store last_seen_id for {channel}: {e}")

    @staticmethod
    def _hash_region(region: str) -> str:
        """Create a hash of region name for use in KV keys."""
        return hashlib.md5(region.lower().encode()).hexdigest()[:8]
