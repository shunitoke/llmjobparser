from desktop.key_store import KeyStore


def test_key_store_roundtrip(tmp_path):
    store = KeyStore(app_name="VibeJobTest", fallback_dir=tmp_path)
    store.set_key("my-secret-key")
    assert store.get_key() == "my-secret-key"


def test_key_store_missing_returns_none(tmp_path):
    store = KeyStore(app_name="VibeJobTestMissing", fallback_dir=tmp_path)
    assert store.get_key() is None
