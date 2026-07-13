from desktop.api_bridge import ApiBridge


def test_api_bridge_get_key_status(tmp_path):
    bridge = ApiBridge(app_data_dir=tmp_path, app_name="JobRadarTestGetStatus")
    assert bridge.getKeyStatus() == {"configured": False}
    bridge.setKey("secret")
    assert bridge.getKeyStatus() == {"configured": True}


def test_api_bridge_set_key(tmp_path):
    bridge = ApiBridge(app_data_dir=tmp_path, app_name="JobRadarTestSetKey")
    result = bridge.setKey("new-secret")
    assert result == {"status": "ok"}
    assert bridge.getKeyStatus() == {"configured": True}


def test_api_bridge_open_external_link_opens_valid_urls(tmp_path):
    from unittest.mock import patch

    bridge = ApiBridge(app_data_dir=tmp_path, app_name="JobRadarTestExternalLink")
    with patch("desktop.api_bridge.webbrowser.open") as mock_open:
        bridge.openExternalLink("https://example.com")
        mock_open.assert_called_once_with("https://example.com")


def test_api_bridge_open_external_link_ignores_invalid_urls(tmp_path):
    from unittest.mock import patch

    bridge = ApiBridge(app_data_dir=tmp_path, app_name="JobRadarTestInvalidLink")
    with patch("desktop.api_bridge.webbrowser.open") as mock_open:
        bridge.openExternalLink("ftp://example.com")
        mock_open.assert_not_called()
        bridge.openExternalLink("")
        mock_open.assert_not_called()


def test_api_bridge_get_stored_key_returns_saved_value(tmp_path):
    bridge = ApiBridge(app_data_dir=tmp_path, app_name="JobRadarTestStoredKey")
    bridge.setKey("saved-key")
    assert bridge.getStoredKey() == "saved-key"