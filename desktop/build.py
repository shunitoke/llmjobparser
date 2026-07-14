import shutil
import subprocess
import sys
from pathlib import Path


def build() -> None:
    project_root = Path(__file__).resolve().parent.parent
    frontend_dir = project_root / "frontend"
    desktop_dir = project_root / "desktop"
    dist_dir = desktop_dir / "dist"

    npm = shutil.which("npm") or "npm"
    print("Building frontend...")
    subprocess.run([npm, "run", "build"], cwd=frontend_dir, check=True, shell=(sys.platform == "win32"))

    if dist_dir.exists():
        shutil.rmtree(dist_dir)

    print("Building executable with PyInstaller...")
    subprocess.run(
        [
            sys.executable,
            "-m",
            "PyInstaller",
            str(desktop_dir / "vibejob.spec"),
            "--clean",
            "--noconfirm",
            "--distpath",
            str(dist_dir),
            "--workpath",
            str(desktop_dir / "build"),
        ],
        cwd=project_root,
        check=True,
    )

    print(f"Done: {dist_dir / 'vibejob.exe'}")


if __name__ == "__main__":
    build()
