import os
import sys
from unittest.mock import patch

from app.database import _get_app_data_dir


def test_app_data_dir_outside_bundle():
    # When not frozen, falls back to the current working directory.
    with patch.object(sys, "frozen", False, create=True):
        path = _get_app_data_dir()
        assert path == "."


def test_app_data_dir_inside_bundle():
    # When frozen, place the data dir next to the executable.
    fake_exe_dir = os.path.join(os.path.dirname(__file__), "..", "..", "tmp-fake-exe")
    fake_exe_dir = os.path.abspath(fake_exe_dir)
    fake_exe = os.path.join(fake_exe_dir, "vibejob.exe")

    # Tell database.py about app data dir before calling (rm it later).
    fake_data_dir = os.path.join(fake_exe_dir, "vibejob-data")
    if os.path.exists(fake_data_dir):
        import shutil
        shutil.rmtree(fake_data_dir, ignore_errors=True)

    with patch.object(sys, "frozen", True, create=True), \
         patch.object(sys, "_MEIPASS", "/tmp/bundle", create=True), \
         patch.object(sys, "executable", fake_exe):
        path = _get_app_data_dir()
        assert path.endswith("vibejob-data")
        assert os.path.isdir(path)
        assert os.path.dirname(path) == fake_exe_dir

    # cleanup
    import shutil
    shutil.rmtree(os.path.join(os.path.dirname(__file__), "..", "..", "tmp-fake-exe"), ignore_errors=True)