from unittest.mock import patch

from desktop.api_bridge import ApiBridge


def test_api_bridge_get_key_status(tmp_path):
    bridge = ApiBridge(app_data_dir=tmp_path)
    assert bridge.get_key_status() == {"configured": False}
    bridge.set_key("secret")
    assert bridge.get_key_status() == {"configured": True}


def test_api_bridge_set_key(tmp_path):
    bridge = ApiBridge(app_data_dir=tmp_path)
    result = bridge.set_key("new-secret")
    assert result == {"status": "ok"}
    assert bridge.get_key_status() == {"configured": True}


def test_api_bridge_open_external_link_opens_valid_urls(tmp_path):
    bridge = ApiBridge(app_data_dir=tmp_path)
    with patch("desktop.api_bridge.webbrowser.open") as mock_open:
        bridge.open_external_link("https://example.com")
        mock_open.assert_called_once_with("https://example.com")


def test_api_bridge_open_external_link_ignores_invalid_urls(tmp_path):
    bridge = ApiBridge(app_data_dir=tmp_path)
    with patch("desktop.api_bridge.webbrowser.open") as mock_open:
        bridge.open_external_link("ftp://example.com")
        mock_open.assert_not_called()
        bridge.open_external_link("")
        mock_open.assert_not_called()
