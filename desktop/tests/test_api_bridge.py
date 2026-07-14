import keyring

from desktop.api_bridge import ApiBridge


def _clear_keyring(service: str) -> None:
    try:
        keyring.delete_password(service, "gigachat_auth_key")
    except keyring.errors.PasswordDeleteError:
        pass


def test_api_bridge_get_key_status(tmp_path):
    app_name = "VibeJobTestGetStatus"
    _clear_keyring(app_name)
    bridge = ApiBridge(app_data_dir=tmp_path, app_name=app_name)
    assert bridge.getKeyStatus() == {"configured": False}
    bridge.setKey("secret")
    assert bridge.getKeyStatus() == {"configured": True}
    _clear_keyring(app_name)


def test_api_bridge_set_key(tmp_path):
    app_name = "VibeJobTestSetKey"
    _clear_keyring(app_name)
    bridge = ApiBridge(app_data_dir=tmp_path, app_name=app_name)
    result = bridge.setKey("new-secret")
    assert result == {"status": "ok"}
    assert bridge.getKeyStatus() == {"configured": True}
    _clear_keyring(app_name)


def test_api_bridge_open_external_link_opens_valid_urls(tmp_path):
    from unittest.mock import patch

    bridge = ApiBridge(app_data_dir=tmp_path, app_name="VibeJobTestExternalLink")
    with patch("desktop.api_bridge.webbrowser.open") as mock_open:
        bridge.openExternalLink("https://example.com")
        mock_open.assert_called_once_with("https://example.com")


def test_api_bridge_open_external_link_ignores_invalid_urls(tmp_path):
    from unittest.mock import patch

    bridge = ApiBridge(app_data_dir=tmp_path, app_name="VibeJobTestInvalidLink")
    with patch("desktop.api_bridge.webbrowser.open") as mock_open:
        bridge.openExternalLink("ftp://example.com")
        mock_open.assert_not_called()
        bridge.openExternalLink("")
        mock_open.assert_not_called()


def test_api_bridge_get_stored_key_returns_saved_value(tmp_path):
    app_name = "VibeJobTestStoredKey"
    _clear_keyring(app_name)
    bridge = ApiBridge(app_data_dir=tmp_path, app_name=app_name)
    bridge.setKey("saved-key")
    assert bridge.getStoredKey() == "saved-key"
    _clear_keyring(app_name)