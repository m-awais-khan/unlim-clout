import os
import json
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

def get_data_dir() -> str:
    env_dir = os.environ.get("UNLIM_CLOUT_DATA_DIR")
    if env_dir:
        os.makedirs(env_dir, exist_ok=True)
        return env_dir
    appdata = os.environ.get("APPDATA") or os.environ.get("LOCALAPPDATA")
    if appdata:
        clout_dir = os.path.join(appdata, "UnlimClout")
        os.makedirs(clout_dir, exist_ok=True)
        return clout_dir
    return os.path.dirname(os.path.dirname(__file__))

def get_settings_file() -> str:
    data_dir = get_data_dir()
    return os.path.join(data_dir, "settings.json")

SETTINGS_FILE = get_settings_file()

DEFAULT_SETTINGS: Dict[str, Any] = {
    "drive_enabled": False,
    "worker_url": "http://localhost:8001",
    "staging_dir": "/content/drive/MyDrive/CloutStaging",
    "colab_runtime_type": "cpu",  # 'cpu' | 'gpu'
    "auto_cleanup_parts": True,
    "api_id": 6,
    "api_hash": "eb06d4abfb49dc3eeb1aeb98ae0f581e",
    "bot_token": "",
    "target_chat_id": ""
}

def load_settings() -> Dict[str, Any]:
    """Loads settings from settings.json, falling back to defaults."""
    settings_file = get_settings_file()
    if not os.path.exists(settings_file):
        return DEFAULT_SETTINGS.copy()
    try:
        with open(settings_file, "r", encoding="utf-8") as f:
            data = json.load(f)
            merged = DEFAULT_SETTINGS.copy()
            merged.update(data)
            return merged
    except Exception as e:
        logger.error(f"Error loading settings: {e}")
        return DEFAULT_SETTINGS.copy()

def save_settings(new_settings: Dict[str, Any]) -> Dict[str, Any]:
    """Updates and saves settings to settings.json."""
    settings_file = get_settings_file()
    current = load_settings()
    current.update(new_settings)
    try:
        with open(settings_file, "w", encoding="utf-8") as f:
            json.dump(current, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving settings: {e}")
        raise e
    return current
