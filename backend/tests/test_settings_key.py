import pytest
from fastapi.testclient import TestClient

from app.key_manager import key_manager as _key_manager
from app.llm_service import LLMService
from app.main import app


client = TestClient(app)


@pytest.fixture(autouse=True)
def reset_key_manager():
    _key_manager._runtime_key = None
    yield
    _key_manager._runtime_key = None


def test_llm_service_instances_share_key_manager():
    service_a = LLMService()
    service_b = LLMService()
    assert service_a._key_manager is service_b._key_manager
    service_a._key_manager.set_key("shared-runtime-key")
    assert service_b._key_manager.get_key() == "shared-runtime-key"


def test_set_gigachat_key_returns_ok_and_updates_singleton():
    response = client.post("/api/settings/gigachat-key", json={"key": "new-runtime-key"})
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}
    assert _key_manager.get_key() == "new-runtime-key"


def test_set_gigachat_key_rejects_empty_key():
    response = client.post("/api/settings/gigachat-key", json={"key": ""})
    assert response.status_code == 400
    assert response.json()["detail"] == "Authorization key cannot be empty"


def test_set_gigachat_key_rejects_whitespace_only_key():
    response = client.post("/api/settings/gigachat-key", json={"key": "   "})
    assert response.status_code == 400
    assert response.json()["detail"] == "Authorization key cannot be empty"


def test_set_gigachat_key_trims_whitespace():
    response = client.post("/api/settings/gigachat-key", json={"key": "  trimmed-key  "})
    assert response.status_code == 200
    assert _key_manager.get_key() == "trimmed-key"
