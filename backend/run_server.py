import sys
import os
import logging
import argparse

# If running as a PyInstaller frozen bundle or standalone
if getattr(sys, "frozen", False):
    # Set default data dir in AppData if not specified
    if not os.environ.get("UNLIM_CLOUT_DATA_DIR"):
        app_data_root = os.environ.get("APPDATA") or os.path.expanduser("~")
        clout_dir = os.path.join(app_data_root, "UnlimClout")
        os.makedirs(clout_dir, exist_ok=True)
        os.environ["UNLIM_CLOUT_DATA_DIR"] = clout_dir

    # Ensure default .env exists in AppData directory
    appdata_env = os.path.join(clout_dir, ".env")
    if not os.path.exists(appdata_env):
        candidate_dirs = [
            getattr(sys, "_MEIPASS", ""),
            os.path.dirname(sys.executable),
            os.path.dirname(os.path.abspath(__file__)),
        ]
        for cdir in candidate_dirs:
            if not cdir:
                continue
            src_env = os.path.join(cdir, ".env")
            if os.path.exists(src_env):
                try:
                    import shutil
                    shutil.copy2(src_env, appdata_env)
                    break
                except Exception:
                    pass

    # Ensure backend.log is written in the user's AppData directory
    log_dir = os.environ["UNLIM_CLOUT_DATA_DIR"]
    log_file = os.path.join(log_dir, "backend.log")
    logging.basicConfig(
        filename=log_file,
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

# Add directory to path
base_dir = os.path.dirname(os.path.abspath(__file__))
if base_dir not in sys.path:
    sys.path.insert(0, base_dir)

import uvicorn
from src.main import app

def main():
    parser = argparse.ArgumentParser(description="Unlim Clout Backend Server")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host interface to bind")
    parser.add_argument("--port", type=int, default=8000, help="Port to listen on")
    parser.add_argument("--log-level", type=str, default="info", help="Uvicorn log level")
    args = parser.parse_args()

    uvicorn.run(
        app,
        host=args.host,
        port=args.port,
        log_level=args.log_level,
        access_log=False,
    )

if __name__ == "__main__":
    main()
