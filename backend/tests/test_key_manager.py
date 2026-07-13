import os
from app.key_manager import KeyManager


def test_key_manager_prefers_env_variable():
    os.environ["GIGACHAT_AUTH_KEY"] = "env-key"
    manager = KeyManager(default_key="default-key")
    assert manager.get_key() == "env-key"
    del os.environ["GIGACHAT_AUTH_KEY"]


def test_key_manager_falls_back_to_default():
    manager = KeyManager(default_key="default-key")
    assert manager.get_key() == "default-key"


def test_key_manager_runtime_override():
    manager = KeyManager(default_key="default-key")
    manager.set_key("runtime-key")
    assert manager.get_key() == "runtime-key"
