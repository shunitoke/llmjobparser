import sys
from unittest.mock import patch
from app.database import _get_app_data_dir


def test_app_data_dir_outside_bundle():
    with patch.object(sys, "_MEIPASS", None, create=True):
        # when not bundled, falls back to current directory
        path = _get_app_data_dir()
        assert path.endswith("job-radar-data") or path == "."


def test_app_data_dir_inside_bundle():
    with patch.object(sys, "_MEIPASS", "/tmp/bundle", create=True):
        with patch.object(sys, "executable", "/tmp/bundle/JobRadar.exe"):
            path = _get_app_data_dir()
            assert "JobRadar.exe" not in path
