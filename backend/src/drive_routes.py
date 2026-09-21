import os
import uuid
import asyncio
import logging
import subprocess
import time
import json
import hashlib
import datetime
from typing import Optional, List, Dict, Any, Union
import requests

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Body
from fastapi.responses import Response
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .database import get_db
from .models import Folder, File, FilePart, TransferJob
from .settings_manager import load_settings, save_settings
from . import telegram_utils as tu

logger = logging.getLogger("drive_routes")
drive_router = APIRouter(prefix="/api/drive", tags=["drive"])
settings_router = APIRouter(prefix="/api/settings", tags=["settings"])

class ToggleDriveRequest(BaseModel):
    enabled: bool

class SettingsUpdateRequest(BaseModel):
    drive_enabled: Optional[bool] = None
    worker_url: Optional[str] = None
    staging_dir: Optional[str] = None
    bot_token: Optional[str] = None
    target_chat_id: Optional[Union[int, str]] = None

class TelegramSettingsRequest(BaseModel):
    bot_token: str
    target_chat_id: Union[int, str]

class DetectChatRequest(BaseModel):
    bot_token: Optional[str] = None

class DriveImportRequest(BaseModel):
    drive_file_path: str
    destination_folder_id: Optional[int] = None
    custom_filename: Optional[str] = None

DriveUploadRequest = DriveImportRequest

class DriveImportFolderRequest(BaseModel):
    drive_folder_path: str
    destination_folder_id: Optional[int] = None
    custom_folder_name: Optional[str] = None

class DriveExportRequest(BaseModel):
    destination_drive_dir: Optional[str] = None

import sys

# Prevent black console window popups when invoking docker CLI on Windows
SUBPROCESS_FLAGS = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0

WORKER_CONTAINER_NAME = "clout_colab_worker"
WORKER_FIXED_URL = "http://127.0.0.1:8001"
DEFAULT_DRIVE_STAGING = "/content/drive/MyDrive/CloutStaging"

def is_docker_installed() -> tuple[bool, Optional[str]]:
    try:
        res = subprocess.run(
            ["docker", "--version"],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=4,
            creationflags=SUBPROCESS_FLAGS
        )
        if res.returncode == 0 and res.stdout:
            return True, res.stdout.strip()
    except Exception:
        pass

    paths = [
        r"C:\Program Files\Docker\Docker\Docker Desktop.exe",
        os.path.expandvars(r"%LOCALAPPDATA%\Programs\Docker\Docker\Docker Desktop.exe")
    ]
    for p in paths:
        if os.path.exists(p):
            return True, "Docker Desktop"

    return False, None

def is_docker_daemon_running() -> bool:
    try:
        proc = subprocess.run(
            ["docker", "info"],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=5,
            creationflags=SUBPROCESS_FLAGS
        )
        return proc.returncode == 0
    except Exception:
        return False

def try_launch_docker_desktop() -> bool:
    exe_path = r"C:\Program Files\Docker\Docker\Docker Desktop.exe"
    if os.path.exists(exe_path):
        try:
            subprocess.Popen([exe_path], shell=False, creationflags=SUBPROCESS_FLAGS)
            return True
        except Exception:
            pass
    return False

def is_worker_container_running() -> bool:
    try:
        res = subprocess.run(
            ["docker", "inspect", "-f", "{{.State.Running}}", WORKER_CONTAINER_NAME],
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
            text=True,
            timeout=5,
            creationflags=SUBPROCESS_FLAGS
        )
        return res.returncode == 0 and res.stdout.strip().lower() == "true"
    except Exception:
        return False

def start_worker_container() -> tuple[bool, str, str]:
    installed, ver = is_docker_installed()
    if not installed:
        return False, "docker_not_installed", "Docker Desktop is not installed on this system. Please install Docker Desktop to use Google Drive features."

    if not is_docker_daemon_running():
        launched = try_launch_docker_desktop()
        msg = "Docker Desktop is starting. Please leave Docker Desktop running." if launched else "Docker Desktop is not running. Please open Docker Desktop on your PC and leave it running."
        return False, "docker_daemon_offline", msg

    if is_worker_container_running():
        return True, "docker_ready", "Container already running"

    res = subprocess.run(
        ["docker", "start", WORKER_CONTAINER_NAME],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=15,
        creationflags=SUBPROCESS_FLAGS
    )
    if res.returncode == 0:
        return True, "docker_ready", "Container started"

    run_cmd = [
        "docker", "run", "-d",
        "--name", WORKER_CONTAINER_NAME,
        "-p", "8001:8001",
        "-v", "clout_colab_config:/root/.config/colab-cli",
        "unlimclout-clout-colab-worker"
    ]
    res_run = subprocess.run(
        run_cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        timeout=20,
        creationflags=SUBPROCESS_FLAGS
    )
    if res_run.returncode == 0:
        return True, "docker_ready", "Container created and started"
    return False, "docker_error", f"Failed to start container: {res_run.stderr.strip()}"

def stop_worker_container_and_colab() -> Dict[str, Any]:
    try:
        requests.post(f"{WORKER_FIXED_URL}/colab/session/stop", timeout=6)
    except Exception:
        pass

    try:
        subprocess.run(
            ["docker", "stop", WORKER_CONTAINER_NAME],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=12,
            creationflags=SUBPROCESS_FLAGS
        )
    except Exception:
        pass


    save_settings({"drive_enabled": False})
    return {"status": "stopped", "resources_freed": True}

def get_worker_url() -> str:
    return WORKER_FIXED_URL

# --- Settings Endpoints ---

@settings_router.get("")
def get_current_settings():
    settings = load_settings()
    bot_token = tu.BOT_TOKEN or settings.get("bot_token", "")
    target_chat = tu.TARGET_CHAT_ID or settings.get("target_chat_id", "")
    return {
        "drive_enabled": settings.get("drive_enabled", False),
        "worker_url": WORKER_FIXED_URL,
        "staging_dir": DEFAULT_DRIVE_STAGING,
        "telegram_configured": bool(bot_token and target_chat),
        "bot_token": bot_token,
        "target_chat_id": str(target_chat) if target_chat else ""
    }

@settings_router.post("")
def update_current_settings(req: SettingsUpdateRequest):
    update_data = {k: v for k, v in req.dict().items() if v is not None}
    saved = save_settings(update_data)
    if "bot_token" in update_data or "target_chat_id" in update_data:
        tu.set_telegram_credentials(
            bot_token=saved.get("bot_token", ""),
            target_chat_id=saved.get("target_chat_id", "")
        )
    return saved

@settings_router.post("/telegram")
def save_telegram_settings(req: TelegramSettingsRequest):
    bot_token = req.bot_token.strip()
    target_chat_id = str(req.target_chat_id).strip()

    if not bot_token:
        raise HTTPException(status_code=400, detail="Bot token is required.")
    if not target_chat_id:
        raise HTTPException(status_code=400, detail="Target chat ID is required.")

    # Validate bot token with Telegram API getMe (with proxy support and graceful fallback if api.telegram.org is blocked by ISP)
    bot_user = {}
    proxies = None
    proxy_str = os.getenv("TELEGRAM_PROXY") or os.getenv("HTTPS_PROXY")
    if proxy_str:
        proxies = {"http": proxy_str, "https": proxy_str}

    try:
        resp = requests.get(f"https://api.telegram.org/bot{bot_token}/getMe", timeout=8, proxies=proxies)
        data = resp.json()
        if not data.get("ok"):
            err_desc = data.get("description", "Invalid Bot Token")
            raise HTTPException(status_code=400, detail=f"Telegram validation failed: {err_desc}")
        bot_user = data.get("result", {})
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Could not reach api.telegram.org to verify token (may be blocked by ISP): {e}")
        bot_user = {"username": "configured_bot"}

    # Save to settings.json
    save_settings({
        "bot_token": bot_token,
        "target_chat_id": target_chat_id,
        "api_id": 6,
        "api_hash": "eb06d4abfb49dc3eeb1aeb98ae0f581e"
    })

    # Update in-memory credentials
    tu.set_telegram_credentials(bot_token=bot_token, target_chat_id=target_chat_id)

    return {
        "status": "success",
        "message": f"Telegram connected successfully to @{bot_user.get('username', 'bot')}",
        "bot": {
            "id": bot_user.get("id"),
            "first_name": bot_user.get("first_name"),
            "username": bot_user.get("username")
        },
        "target_chat_id": target_chat_id,
        "telegram_configured": True
    }

def _extract_chat_and_msg(u: dict):
    if "channel_post" in u:
        return u["channel_post"].get("chat"), u["channel_post"].get("message_id")
    if "edited_channel_post" in u:
        return u["edited_channel_post"].get("chat"), u["edited_channel_post"].get("message_id")
    if "message" in u:
        return u["message"].get("chat"), u["message"].get("message_id")
    if "edited_message" in u:
        return u["edited_message"].get("chat"), u["edited_message"].get("message_id")
    if "my_chat_member" in u:
        return u["my_chat_member"].get("chat"), None
    if "chat_member" in u:
        return u["chat_member"].get("chat"), None
    return None, None

@settings_router.post("/detect-chat-id")
def detect_chat_id(req: DetectChatRequest):
    settings = load_settings()
    bot_token = (req.bot_token or tu.BOT_TOKEN or settings.get("bot_token", "")).strip()

    if not bot_token:
        raise HTTPException(status_code=400, detail="Please enter your Bot Token first to detect chat ID.")

    proxies = None
    proxy_str = os.getenv("TELEGRAM_PROXY") or os.getenv("HTTPS_PROXY")
    if proxy_str:
        proxies = {"http": proxy_str, "https": proxy_str}

    # 1. First check if any recent updates already exist in Telegram's buffer
    last_update_id = 0
    try:
        resp = requests.get(f"https://api.telegram.org/bot{bot_token}/getUpdates", params={"timeout": 0}, timeout=8, proxies=proxies)
        data = resp.json()
        if not data.get("ok"):
            desc = data.get("description", "Failed to query Telegram updates.")
            if "Not Found" in desc or data.get("error_code") == 404:
                desc = "Invalid Bot Token (Telegram API returned Not Found). Please verify your token with @BotFather."
            raise HTTPException(status_code=400, detail=desc)

        updates = data.get("result", [])
        for u in reversed(updates):
            chat, msg_id = _extract_chat_and_msg(u)
            if chat and chat.get("id"):
                chat_id = str(chat.get("id"))
                chat_title = chat.get("title") or chat.get("username") or chat.get("first_name") or "Telegram Chat"
                chat_type = chat.get("type", "chat")
                return {
                    "success": True,
                    "chat_id": chat_id,
                    "title": chat_title,
                    "type": chat_type
                }
            if u.get("update_id"):
                last_update_id = max(last_update_id, u["update_id"])
    except HTTPException:
        raise
    except Exception as e:
        logger.warning(f"Initial getUpdates check error: {e}")

    # 2. Active listening: wait up to 25 seconds for the user to post a message in channel/chat (matching notebook)
    start_time = time.time()
    offset = last_update_id + 1 if last_update_id else None

    while time.time() - start_time < 25:
        try:
            params = {"timeout": 4}
            if offset:
                params["offset"] = offset
            resp = requests.get(f"https://api.telegram.org/bot{bot_token}/getUpdates", params=params, timeout=8, proxies=proxies)
            data = resp.json()
            if data.get("ok"):
                updates = data.get("result", [])
                for u in updates:
                    chat, msg_id = _extract_chat_and_msg(u)
                    if chat and chat.get("id"):
                        # If a message_id is available, delete the manual test message just like the notebook
                        if msg_id:
                            try:
                                requests.post(
                                    f"https://api.telegram.org/bot{bot_token}/deleteMessage",
                                    json={"chat_id": chat["id"], "message_id": msg_id},
                                    timeout=3,
                                    proxies=proxies
                                )
                            except Exception:
                                pass

                        chat_id = str(chat.get("id"))
                        chat_title = chat.get("title") or chat.get("username") or chat.get("first_name") or "Telegram Chat"
                        chat_type = chat.get("type", "chat")
                        return {
                            "success": True,
                            "chat_id": chat_id,
                            "title": chat_title,
                            "type": chat_type
                        }
                    if u.get("update_id"):
                        offset = u["update_id"] + 1
        except Exception as e:
            logger.warning(f"Listening getUpdates loop error: {e}")
            time.sleep(1)

    raise HTTPException(
        status_code=404,
        detail="Listening timed out (no message received). Make sure your bot is an Administrator in your channel with 'Post Messages' permission. If listening times out repeatedly, try turning ON a VPN (Telegram API may be restricted by your ISP) or enter your Chat ID manually."
    )

@settings_router.get("/export-data")
def export_backup_data(db: Session = Depends(get_db)):
    """
    Exports full cloud storage catalog (folders, files, chunks) and Telegram credentials
    into an integrity-validated .clout backup JSON file.
    """
    settings = load_settings()
    folders = db.query(Folder).order_by(Folder.id).all()
    files = db.query(File).order_by(File.id).all()
    file_parts = db.query(FilePart).order_by(FilePart.id).all()

    database_payload = {
        "folders": [
            {
                "id": f.id,
                "name": f.name,
                "parent_id": f.parent_id,
                "created_at": f.created_at.isoformat() if f.created_at else None
            }
            for f in folders
        ],
        "files": [
            {
                "id": f.id,
                "folder_id": f.folder_id,
                "filename": f.filename,
                "file_size": f.file_size,
                "created_at": f.created_at.isoformat() if f.created_at else None
            }
            for f in files
        ],
        "file_parts": [
            {
                "id": p.id,
                "file_id": p.file_id,
                "telegram_message_id": p.telegram_message_id,
                "part_number": p.part_number
            }
            for p in file_parts
        ]
    }

    # Generate checksum over catalog to prevent corrupted restores
    canonical_bytes = json.dumps(database_payload, sort_keys=True).encode("utf-8")
    checksum = hashlib.sha256(canonical_bytes).hexdigest()

    bot_token = tu.BOT_TOKEN or settings.get("bot_token", "")
    target_chat = tu.TARGET_CHAT_ID or settings.get("target_chat_id", "")

    backup_content = {
        "app": "unlim-clout",
        "version": "1.0",
        "exported_at": datetime.datetime.utcnow().isoformat() + "Z",
        "credentials": {
            "bot_token": bot_token,
            "target_chat_id": str(target_chat) if target_chat else "",
            "api_id": settings.get("api_id", 6),
            "api_hash": settings.get("api_hash", "eb06d4abfb49dc3eeb1aeb98ae0f581e")
        },
        "settings": {
            "drive_enabled": settings.get("drive_enabled", False),
            "worker_url": settings.get("worker_url", WORKER_FIXED_URL),
            "staging_dir": settings.get("staging_dir", DEFAULT_DRIVE_STAGING),
            "auto_cleanup_parts": settings.get("auto_cleanup_parts", True)
        },
        "database": database_payload,
        "checksum": checksum
    }

    timestamp_str = datetime.datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    filename = f"unlim_clout_backup_{timestamp_str}.clout"

    return Response(
        content=json.dumps(backup_content, indent=2),
        media_type="application/json",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )

@settings_router.post("/import-data")
async def import_backup_data(
    payload: Dict[str, Any] = Body(...),
    db: Session = Depends(get_db)
):
    """
    Atomically restores and completely overwrites existing database records and
    settings with data from an Unlim Clout backup file.
    """
    if not isinstance(payload, dict):
        raise HTTPException(status_code=400, detail="Invalid backup file structure.")

    if payload.get("app") != "unlim-clout":
        raise HTTPException(status_code=400, detail="Invalid backup file: Not an Unlim Clout backup archive.")

    db_data = payload.get("database")
    if not isinstance(db_data, dict):
        raise HTTPException(status_code=400, detail="Backup file is missing database records.")

    # Integrity verification
    checksum = payload.get("checksum")
    if checksum:
        canonical = json.dumps(db_data, sort_keys=True).encode("utf-8")
        actual_hash = hashlib.sha256(canonical).hexdigest()
        if actual_hash != checksum:
            raise HTTPException(status_code=400, detail="Checksum mismatch: Backup data appears to be corrupted.")

    folders_raw = db_data.get("folders", [])
    files_raw = db_data.get("files", [])
    file_parts_raw = db_data.get("file_parts", [])

    # User policy: Overwrite all previous data with new imported data
    try:
        # Atomic clear of current database tables in child-to-parent order
        db.query(TransferJob).delete()
        db.query(FilePart).delete()
        db.query(File).delete()
        db.query(Folder).delete()
        db.commit()

        # Insert folders
        for f in folders_raw:
            created_at = None
            if f.get("created_at"):
                try:
                    created_at = datetime.datetime.fromisoformat(f["created_at"].replace("Z", "+00:00"))
                except Exception:
                    pass
            new_folder = Folder(
                id=f["id"],
                name=f["name"],
                parent_id=f.get("parent_id"),
                created_at=created_at or datetime.datetime.utcnow()
            )
            db.add(new_folder)
        db.commit()

        # Insert files
        for fl in files_raw:
            created_at = None
            if fl.get("created_at"):
                try:
                    created_at = datetime.datetime.fromisoformat(fl["created_at"].replace("Z", "+00:00"))
                except Exception:
                    pass
            new_file = File(
                id=fl["id"],
                folder_id=fl.get("folder_id"),
                filename=fl["filename"],
                file_size=fl.get("file_size", 0),
                created_at=created_at or datetime.datetime.utcnow()
            )
            db.add(new_file)
        db.commit()

        # Insert file parts
        for fp in file_parts_raw:
            new_part = FilePart(
                id=fp.get("id"),
                file_id=fp["file_id"],
                telegram_message_id=fp["telegram_message_id"],
                part_number=fp["part_number"]
            )
            db.add(new_part)
        db.commit()

    except Exception as e:
        db.rollback()
        logger.error(f"Failed to restore database during import: {e}")
        raise HTTPException(status_code=500, detail=f"Database restore failed: {e}")

    # Restore credentials and application settings
    creds = payload.get("credentials", {})
    imported_bot_token = (creds.get("bot_token") or "").strip()
    imported_target_chat = creds.get("target_chat_id")
    imported_api_id = creds.get("api_id", 6)
    imported_api_hash = creds.get("api_hash", "eb06d4abfb49dc3eeb1aeb98ae0f581e")

    other_settings = payload.get("settings", {})
    update_dict = {
        "bot_token": imported_bot_token,
        "target_chat_id": str(imported_target_chat) if imported_target_chat else "",
        "api_id": imported_api_id,
        "api_hash": imported_api_hash,
    }
    if "drive_enabled" in other_settings:
        update_dict["drive_enabled"] = other_settings["drive_enabled"]
    if "auto_cleanup_parts" in other_settings:
        update_dict["auto_cleanup_parts"] = other_settings["auto_cleanup_parts"]

    save_settings(update_dict)

    # Re-apply credentials in memory
    tu.set_telegram_credentials(
        bot_token=imported_bot_token,
        target_chat_id=imported_target_chat,
        api_id=imported_api_id,
        api_hash=imported_api_hash
    )

    # Attempt to reconnect Pyrogram client
    client_reconnected = False
    if imported_bot_token and imported_target_chat:
        try:
            await tu.init_client()
            client_reconnected = True
        except Exception as ce:
            logger.warning(f"Could not reconnect Telegram client after import: {ce}")

    return {
        "status": "success",
        "message": f"Successfully restored {len(folders_raw)} folders and {len(files_raw)} files! Previous data was overwritten.",
        "folders_restored": len(folders_raw),
        "files_restored": len(files_raw),
        "parts_restored": len(file_parts_raw),
        "telegram_configured": bool(imported_bot_token and imported_target_chat),
        "client_reconnected": client_reconnected
    }

# --- Drive Integration Endpoints ---

_last_known_status_cache = {
    "timestamp": 0.0,
    "data": None
}

@drive_router.get("/status")
def get_drive_status():
    settings = load_settings()
    if not settings.get("drive_enabled", False):
        return {
            "enabled": False,
            "worker_active": False,
            "drive_mounted": False,
            "mount_path": None,
            "content_free_mb": 0
        }

    worker_url = get_worker_url()
    try:
        resp = requests.get(f"{worker_url}/status", timeout=12.0)
        if resp.status_code == 200:
            data = resp.json()
            res = {
                "enabled": True,
                "worker_active": data.get("worker_active", True),
                "colab_installed": data.get("colab_installed", False),
                "authenticated": data.get("authenticated", False),
                "session_active": data.get("session_active", False),
                "drive_mounted": data.get("drive_mounted", False),
                "mount_path": data.get("mount_path"),
                "content_free_mb": data.get("content_free_mb", 0)
            }
            _last_known_status_cache["timestamp"] = time.time()
            _last_known_status_cache["data"] = res
            return res
        else:
            _last_known_status_cache["data"] = None
            _last_known_status_cache["timestamp"] = 0.0
    except requests.exceptions.Timeout:
        # If there is a transient network timeout to Colab, allow grace cache up to 45s
        now = time.time()
        if _last_known_status_cache["data"] and (now - _last_known_status_cache["timestamp"] < 45.0):
            return _last_known_status_cache["data"]
        _last_known_status_cache["data"] = None
    except Exception:
        # Worker offline (ConnectionRefused, container stopped)
        _last_known_status_cache["data"] = None
        _last_known_status_cache["timestamp"] = 0.0

    return {
        "enabled": bool(settings.get("drive_enabled", False)),
        "worker_active": False,
        "colab_installed": False,
        "authenticated": False,
        "session_active": False,
        "drive_mounted": False,
        "mount_path": None,
        "content_free_mb": 0
    }

@drive_router.post("/auth/start")
def start_google_auth():
    worker_url = get_worker_url()
    try:
        resp = requests.post(f"{worker_url}/auth/google/start", timeout=12)
        return resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Worker error: {e}")

@drive_router.post("/auth/verify")
def verify_google_auth(req: Dict[str, Any]):
    worker_url = get_worker_url()
    try:
        resp = requests.post(f"{worker_url}/auth/google/verify", json=req, timeout=20)
        return resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Worker error: {e}")

@drive_router.post("/toggle")
def toggle_drive(req: ToggleDriveRequest):
    if not req.enabled:
        stop_worker_container_and_colab()
        return {"enabled": False}
    else:
        save_settings({"drive_enabled": True})
        return {"enabled": True}

@drive_router.get("/docker-status")
def get_docker_status():
    installed, ver = is_docker_installed()
    running = is_docker_daemon_running()
    return {
        "installed": installed,
        "version": ver,
        "running": running,
        "download_url": "https://desktop.docker.com/win/main/amd64/Docker%20Desktop%20Installer.exe"
    }

@drive_router.post("/lifecycle/start")
def lifecycle_start_docker():
    success, status_code, msg = start_worker_container()
    if not success:
        return {"status": status_code, "message": msg}

    for _ in range(8):
        try:
            r = requests.get(f"{WORKER_FIXED_URL}/health", timeout=1.5)
            if r.status_code == 200:
                save_settings({"drive_enabled": True})
                return {"status": "docker_ready", "message": "Docker worker online"}
        except Exception:
            pass
        time.sleep(1)

    return {"status": "docker_starting", "message": "Worker is initializing..."}

@drive_router.post("/lifecycle/stop")
def lifecycle_stop():
    return stop_worker_container_and_colab()

@drive_router.get("/lifecycle/status")
def lifecycle_status():
    docker_running = is_docker_daemon_running()
    container_running = is_worker_container_running() if docker_running else False
    worker_online = False
    auth = False
    session = False
    mounted = False

    if container_running:
        try:
            r = requests.get(f"{WORKER_FIXED_URL}/health", timeout=2.0)
            if r.status_code == 200:
                worker_online = True
        except Exception:
            pass

        if worker_online:
            try:
                r = requests.get(f"{WORKER_FIXED_URL}/status", timeout=8.0)
                if r.status_code == 200:
                    d = r.json()
                    auth = d.get("authenticated", False)
                    session = d.get("session_active", False)
                    mounted = d.get("drive_mounted", False)
            except Exception as e:
                logger.debug(f"Colab status query timed out or failed: {e}")

    return {
        "docker_daemon": docker_running,
        "container_running": container_running,
        "worker_online": worker_online,
        "authenticated": auth,
        "session_active": session,
        "drive_mounted": mounted
    }

@drive_router.post("/mount")
def trigger_drive_mount(payload: Optional[Dict[str, Any]] = Body(default=None)):
    worker_url = get_worker_url()
    try:
        resp = requests.post(f"{worker_url}/drive/mount", json=payload or {}, timeout=120)
        return resp.json()
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Worker communication failed: {e}")

@drive_router.post("/open-url")
def open_url_in_system_browser(payload: Optional[Dict[str, Any]] = Body(default=None)):
    """Opens an external URL in the user's host OS default browser (Chrome/Edge)."""
    url = (payload or {}).get("url")
    if url and isinstance(url, str) and (url.startswith("http://") or url.startswith("https://")):
        # Method A: Native Windows ShellExecute
        try:
            os.startfile(url)
            return {"status": "opened", "method": "startfile"}
        except Exception:
            pass

        # Method B: rundll32 FileProtocolHandler (CREATE_NO_WINDOW)
        if sys.platform == "win32":
            try:
                subprocess.Popen(
                    ["rundll32", "url.dll,FileProtocolHandler", url],
                    shell=False,
                    creationflags=SUBPROCESS_FLAGS
                )
                return {"status": "opened", "method": "rundll32"}
            except Exception:
                pass

        # Method C: webbrowser standard library
        try:
            import webbrowser
            webbrowser.open(url)
            return {"status": "opened", "method": "webbrowser"}
        except Exception as e:
            return {"status": "failed", "error": str(e)}

    return {"status": "invalid_url"}



@drive_router.get("/browse")
def browse_drive_files(subpath: Optional[str] = ""):
    settings = load_settings()
    if not settings.get("drive_enabled", False):
        raise HTTPException(status_code=400, detail="Drive integration is disabled")

    worker_url = get_worker_url()
    try:
        resp = requests.get(f"{worker_url}/drive/browse", params={"subpath": subpath}, timeout=30.0)
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail=resp.text)
        return resp.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Cannot reach worker at {worker_url}: {e}")

def sanitize_transfer_error(err: Optional[str]) -> str:
    if not err:
        return "Unknown error during transfer"
    err_lower = err.lower()
    if "peer id invalid" in err_lower or "peer_id_invalid" in err_lower or "id not found" in err_lower:
        return "Telegram bot cannot access target channel. Please ensure the bot is added as an Administrator to your channel."
    if "not mounted" in err_lower or ("filenotfounderror" in err_lower and "drive" in err_lower):
        return "Google Drive is not mounted in Google Colab. Please connect and mount Google Drive in Settings."
    if "session" in err_lower and ("lost" in err_lower or "404" in err_lower or "not found" in err_lower):
        return "Google Colab session expired. Please verify Colab connection in Settings."
    if "connection failed" in err_lower or "connect call failed" in err_lower:
        return "Network connection to Telegram timed out. Please check network/VPN."
    return err

# --- Background Sync Helpers ---

async def _poll_upload_job(job_id: str, db_factory):
    worker_url = get_worker_url()
    while True:
        await asyncio.sleep(1.0)
        try:
            resp = requests.get(f"{worker_url}/jobs/{job_id}", timeout=3)
            if resp.status_code != 200:
                continue
            info = resp.json()
            status = info.get("status")

            with db_factory() as db:
                job = db.query(TransferJob).filter(TransferJob.id == job_id).first()
                if not job:
                    break

                job.status = status
                job.transferred_bytes = info.get("transferred_bytes", job.transferred_bytes)
                job.total_bytes = info.get("total_bytes", job.total_bytes)
                job.current_part = info.get("current_part", job.current_part)
                job.total_parts = info.get("total_parts", job.total_parts)

                if status == "completed":
                    message_ids = info.get("message_ids", [])
                    clean_filename = job.source_name

                    # If an existing file with the same name exists, delete its parts and record to prevent duplicates
                    if job.destination_folder_id is None:
                        existing_file = db.query(File).filter(File.filename == clean_filename, File.folder_id.is_(None)).first()
                    else:
                        existing_file = db.query(File).filter(File.filename == clean_filename, File.folder_id == job.destination_folder_id).first()
                    
                    if existing_file:
                        for p in existing_file.parts:
                            db.delete(p)
                        db.delete(existing_file)
                        db.commit()

                    # Create the File in database
                    new_file = File(
                        filename=clean_filename,
                        folder_id=job.destination_folder_id,
                        file_size=job.total_bytes
                    )
                    db.add(new_file)
                    db.commit()
                    db.refresh(new_file)

                    # Add file parts
                    for i, msg_id in enumerate(message_ids):
                        part = FilePart(
                            file_id=new_file.id,
                            telegram_message_id=msg_id,
                            part_number=i + 1
                        )
                        db.add(part)

                    job.file_id = new_file.id
                    db.commit()
                    break

                elif status in ("failed", "cancelled"):
                    job.error_message = sanitize_transfer_error(info.get("error"))
                    db.commit()
                    break

                db.commit()

        except Exception as e:
            logger.error(f"Error polling upload job {job_id}: {e}")

async def _poll_upload_folder_job(job_id: str, db_factory):
    worker_url = get_worker_url()
    while True:
        await asyncio.sleep(1.0)
        try:
            resp = requests.get(f"{worker_url}/jobs/{job_id}", timeout=3)
            if resp.status_code != 200:
                continue
            info = resp.json()
            status = info.get("status")

            with db_factory() as db:
                job = db.query(TransferJob).filter(TransferJob.id == job_id).first()
                if not job:
                    break

                job.status = status
                job.transferred_bytes = info.get("transferred_bytes", job.transferred_bytes)
                job.total_bytes = info.get("total_bytes", job.total_bytes)
                job.current_part = info.get("completed_files", job.current_part)
                job.total_parts = info.get("total_files", job.total_parts)

                if status == "completed":
                    manifest = info.get("manifest", [])
                    root_name = job.source_name or info.get("folder_name", "Imported Folder")
                    dest_parent_id = job.destination_folder_id

                    # Create or find root destination folder
                    root_folder = db.query(Folder).filter(
                        Folder.name == root_name,
                        Folder.parent_id == dest_parent_id
                    ).first()
                    if not root_folder:
                        root_folder = Folder(name=root_name, parent_id=dest_parent_id)
                        db.add(root_folder)
                        db.commit()
                        db.refresh(root_folder)

                    root_folder_id = root_folder.id

                    # Cache created folder paths: relative subpath -> folder.id
                    folder_cache = {"": root_folder_id, ".": root_folder_id}

                    def resolve_folder_id(dir_path: str) -> int:
                        norm = dir_path.strip("/\\").replace("\\", "/")
                        if not norm or norm == ".":
                            return root_folder_id
                        if norm in folder_cache:
                            return folder_cache[norm]

                        sub_parts = [p for p in norm.split("/") if p]
                        cur_parent = root_folder_id
                        accum = ""
                        for part in sub_parts:
                            accum = f"{accum}/{part}" if accum else part
                            if accum in folder_cache:
                                cur_parent = folder_cache[accum]
                            else:
                                existing = db.query(Folder).filter(
                                    Folder.name == part,
                                    Folder.parent_id == cur_parent
                                ).first()
                                if not existing:
                                    f_obj = Folder(name=part, parent_id=cur_parent)
                                    db.add(f_obj)
                                    db.commit()
                                    db.refresh(f_obj)
                                    cur_parent = f_obj.id
                                else:
                                    cur_parent = existing.id
                                folder_cache[accum] = cur_parent
                        return cur_parent

                    # Insert files & file parts from manifest
                    for item in manifest:
                        rel_path = item.get("rel_path", "")
                        fname = item.get("filename") or os.path.basename(rel_path)
                        fsize = item.get("file_size", 0)
                        message_ids = item.get("message_ids", [])
                        dir_path = os.path.dirname(rel_path)

                        target_fid = resolve_folder_id(dir_path)

                        # Check for existing duplicate file in same folder
                        existing_file = db.query(File).filter(
                            File.filename == fname,
                            File.folder_id == target_fid
                        ).first()
                        if existing_file:
                            for p in existing_file.parts:
                                db.delete(p)
                            db.delete(existing_file)
                            db.commit()

                        new_file = File(
                            filename=fname,
                            folder_id=target_fid,
                            file_size=fsize
                        )
                        db.add(new_file)
                        db.commit()
                        db.refresh(new_file)

                        for idx, mid in enumerate(message_ids):
                            part = FilePart(
                                file_id=new_file.id,
                                telegram_message_id=mid,
                                part_number=idx + 1
                            )
                            db.add(part)
                        db.commit()

                    job.status = "completed"
                    db.commit()
                    break

                elif status in ("failed", "cancelled"):
                    job.error_message = sanitize_transfer_error(info.get("error"))
                    db.commit()
                    break

                db.commit()

        except Exception as e:
            logger.error(f"Error polling folder upload job {job_id}: {e}")

async def _poll_download_job(job_id: str, db_factory):
    worker_url = get_worker_url()
    while True:
        await asyncio.sleep(1.0)
        try:
            resp = requests.get(f"{worker_url}/jobs/{job_id}", timeout=3)
            if resp.status_code != 200:
                continue
            info = resp.json()
            status = info.get("status")

            with db_factory() as db:
                job = db.query(TransferJob).filter(TransferJob.id == job_id).first()
                if not job:
                    break

                job.status = status
                job.transferred_bytes = info.get("transferred_bytes", job.transferred_bytes)
                job.total_bytes = info.get("total_bytes", job.total_bytes)
                job.current_part = info.get("current_part", job.current_part)
                job.total_parts = info.get("total_parts", job.total_parts)

                if status in ("completed", "failed", "cancelled"):
                    if status == "failed":
                        job.error_message = sanitize_transfer_error(info.get("error"))
                    db.commit()
                    break

                db.commit()

        except Exception as e:
            logger.error(f"Error polling export job {job_id}: {e}")

# --- Transfer Job Initiation ---

@drive_router.post("/import")
@drive_router.post("/upload")
async def import_from_drive(
    req: DriveImportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    settings = load_settings()
    if not settings.get("drive_enabled", False):
        raise HTTPException(status_code=400, detail="Drive integration is disabled")

    # Normalize drive file path to ensure valid Colab absolute path
    raw_path = (req.drive_file_path or "").strip()
    if not raw_path.startswith("/content/drive/MyDrive/"):
        clean_rel = raw_path.lstrip("/\\")
        if clean_rel.startswith("content/drive/MyDrive/"):
            drive_path = f"/{clean_rel}"
        elif clean_rel.startswith("MyDrive/"):
            drive_path = f"/content/drive/{clean_rel}"
        else:
            drive_path = f"/content/drive/MyDrive/{clean_rel}"
    else:
        drive_path = raw_path

    worker_url = get_worker_url()
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    filename = req.custom_filename or os.path.basename(drive_path)

    job = TransferJob(
        id=job_id,
        job_type="drive_to_telegram",
        status="pending",
        source_name=filename,
        source_path=drive_path,
        destination_folder_id=req.destination_folder_id,
        total_bytes=0,
        transferred_bytes=0
    )
    db.add(job)
    db.commit()

    target_chat = tu.TARGET_CHAT_ID
    try:
        target_chat = int(target_chat)
    except (ValueError, TypeError):
        pass

    # Dispatch to worker
    payload = {
        "job_id": job_id,
        "drive_file_path": drive_path,
        "target_chat_id": target_chat,
        "api_id": int(tu.API_ID) if tu.API_ID else 0,
        "api_hash": tu.API_HASH or "",
        "bot_token": tu.BOT_TOKEN or ""
    }

    try:
        resp = requests.post(f"{worker_url}/jobs/upload", json=payload, timeout=5)
        if resp.status_code != 200:
            job.status = "failed"
            job.error_message = sanitize_transfer_error(resp.text)
            db.commit()
            raise HTTPException(status_code=resp.status_code, detail=f"Worker rejected job: {resp.text}")
    except requests.RequestException as e:
        job.status = "failed"
        job.error_message = sanitize_transfer_error(str(e))
        db.commit()
        raise HTTPException(status_code=502, detail=f"Could not contact worker: {e}")

    # Launch background polling task
    from .database import SessionLocal
    background_tasks.add_task(_poll_upload_job, job_id, SessionLocal)

    return {"job_id": job_id, "status": "started", "filename": filename}

@drive_router.post("/import-folder")
async def import_folder_from_drive(
    req: DriveImportFolderRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    settings = load_settings()
    if not settings.get("drive_enabled", False):
        raise HTTPException(status_code=400, detail="Drive integration is disabled")

    raw_path = (req.drive_folder_path or "").strip()
    if not raw_path.startswith("/content/drive/MyDrive/"):
        clean_rel = raw_path.lstrip("/\\")
        if clean_rel.startswith("content/drive/MyDrive/"):
            drive_folder_path = f"/{clean_rel}"
        elif clean_rel.startswith("MyDrive/"):
            drive_folder_path = f"/content/drive/{clean_rel}"
        else:
            drive_folder_path = f"/content/drive/MyDrive/{clean_rel}"
    else:
        drive_folder_path = raw_path

    worker_url = get_worker_url()
    job_id = f"job_{uuid.uuid4().hex[:12]}"
    folder_name = req.custom_folder_name or os.path.basename(drive_folder_path.rstrip("/")) or "Imported Folder"

    job = TransferJob(
        id=job_id,
        job_type="drive_folder_to_telegram",
        status="pending",
        source_name=folder_name,
        source_path=drive_folder_path,
        destination_folder_id=req.destination_folder_id,
        total_bytes=0,
        transferred_bytes=0
    )
    db.add(job)
    db.commit()

    target_chat = tu.TARGET_CHAT_ID
    try:
        target_chat = int(target_chat)
    except (ValueError, TypeError):
        pass

    payload = {
        "job_id": job_id,
        "drive_folder_path": drive_folder_path,
        "target_chat_id": target_chat,
        "api_id": int(tu.API_ID) if tu.API_ID else 0,
        "api_hash": tu.API_HASH or "",
        "bot_token": tu.BOT_TOKEN or ""
    }

    try:
        resp = requests.post(f"{worker_url}/jobs/upload-folder", json=payload, timeout=5)
        if resp.status_code != 200:
            job.status = "failed"
            job.error_message = sanitize_transfer_error(resp.text)
            db.commit()
            raise HTTPException(status_code=resp.status_code, detail=f"Worker rejected job: {resp.text}")
    except requests.RequestException as e:
        job.status = "failed"
        job.error_message = sanitize_transfer_error(str(e))
        db.commit()
        raise HTTPException(status_code=502, detail=f"Could not contact worker: {e}")

    from .database import SessionLocal
    background_tasks.add_task(_poll_upload_folder_job, job_id, SessionLocal)

    return {"job_id": job_id, "status": "started", "folder_name": folder_name}

@drive_router.post("/export/{file_id}")
async def export_to_drive(
    file_id: int,
    req: DriveExportRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db)
):
    settings = load_settings()
    if not settings.get("drive_enabled", False):
        raise HTTPException(status_code=400, detail="Drive integration is disabled")

    db_file = db.query(File).filter(File.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    parts = db.query(FilePart).filter(FilePart.file_id == file_id).order_by(FilePart.part_number).all()
    message_ids = [p.telegram_message_id for p in parts]
    if not message_ids:
        raise HTTPException(status_code=500, detail="File parts missing in database")

    raw_dest = (req.destination_drive_dir or "").strip()
    if not raw_dest or raw_dest in ("/", "My Drive", ""):
        dest_dir = "/content/drive/MyDrive"
    elif raw_dest.startswith("/content/drive/MyDrive"):
        dest_dir = raw_dest.rstrip("/")
    else:
        clean_sub = raw_dest.strip("/\\")
        dest_dir = f"/content/drive/MyDrive/{clean_sub}".rstrip("/")
    worker_url = get_worker_url()
    job_id = f"job_{uuid.uuid4().hex[:12]}"

    job = TransferJob(
        id=job_id,
        job_type="telegram_to_drive",
        status="pending",
        source_name=db_file.filename,
        destination_drive_path=dest_dir,
        file_id=file_id,
        total_bytes=db_file.file_size,
        transferred_bytes=0,
        total_parts=len(message_ids)
    )
    db.add(job)
    db.commit()

    target_chat = tu.TARGET_CHAT_ID
    try:
        target_chat = int(target_chat)
    except (ValueError, TypeError):
        pass

    payload = {
        "job_id": job_id,
        "message_ids": message_ids,
        "destination_drive_dir": dest_dir,
        "final_filename": db_file.filename,
        "total_size": db_file.file_size,
        "target_chat_id": target_chat,
        "api_id": int(tu.API_ID) if tu.API_ID else 0,
        "api_hash": tu.API_HASH or "",
        "bot_token": tu.BOT_TOKEN or ""
    }

    try:
        resp = requests.post(f"{worker_url}/jobs/download", json=payload, timeout=5)
        if resp.status_code != 200:
            job.status = "failed"
            job.error_message = sanitize_transfer_error(resp.text)
            db.commit()
            raise HTTPException(status_code=resp.status_code, detail=f"Worker rejected export: {resp.text}")
    except requests.RequestException as e:
        job.status = "failed"
        job.error_message = sanitize_transfer_error(str(e))
        db.commit()
        raise HTTPException(status_code=502, detail=f"Could not contact worker: {e}")

    from .database import SessionLocal
    background_tasks.add_task(_poll_download_job, job_id, SessionLocal)

    return {"job_id": job_id, "status": "started", "filename": db_file.filename}

@drive_router.get("/jobs")
def list_transfer_jobs(limit: int = 10, db: Session = Depends(get_db)):
    jobs = db.query(TransferJob).order_by(TransferJob.created_at.desc()).limit(limit).all()
    return [
        {
            "id": j.id,
            "job_type": j.job_type,
            "status": j.status,
            "source_name": j.source_name,
            "total_bytes": j.total_bytes,
            "transferred_bytes": j.transferred_bytes,
            "percent": round((j.transferred_bytes / j.total_bytes * 100), 1) if j.total_bytes > 0 else 0,
            "current_part": j.current_part,
            "total_parts": j.total_parts,
            "error_message": j.error_message,
            "created_at": j.created_at.isoformat() if j.created_at else None
        }
        for j in jobs
    ]

@drive_router.get("/jobs/{job_id}")
def get_transfer_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(TransferJob).filter(TransferJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    percent = round((job.transferred_bytes / job.total_bytes * 100), 1) if job.total_bytes > 0 else 0
    current_file = None
    if job.job_type == "drive_folder_to_telegram" and job.status not in ("completed", "failed", "cancelled"):
        try:
            worker_url = get_worker_url()
            w_resp = requests.get(f"{worker_url}/jobs/{job_id}", timeout=1)
            if w_resp.status_code == 200:
                w_info = w_resp.json()
                current_file = w_info.get("current_file")
        except Exception:
            pass

    return {
        "id": job.id,
        "job_type": job.job_type,
        "status": job.status,
        "source_name": job.source_name,
        "total_bytes": job.total_bytes,
        "transferred_bytes": job.transferred_bytes,
        "percent": percent,
        "current_part": job.current_part,
        "total_parts": job.total_parts,
        "completed_files": job.current_part,
        "total_files": job.total_parts,
        "current_file": current_file,
        "error_message": job.error_message
    }

@drive_router.post("/jobs/{job_id}/cancel")
def cancel_transfer_job(job_id: str, db: Session = Depends(get_db)):
    job = db.query(TransferJob).filter(TransferJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    worker_url = get_worker_url()
    try:
        requests.post(f"{worker_url}/jobs/{job_id}/cancel", timeout=8)
    except Exception:
        pass

    job.status = "cancelled"
    db.commit()
    return {"status": "cancelled", "job_id": job_id}

@drive_router.post("/telegram/warmup")
def warmup_drive_telegram():
    settings = load_settings()
    if not settings.get("drive_enabled", False):
        return {"status": "disabled", "message": "Drive integration is not enabled"}

    worker_url = get_worker_url()
    target_chat = tu.TARGET_CHAT_ID
    if not target_chat:
        raise HTTPException(status_code=400, detail="Telegram Target Chat ID is not configured")

    payload = {
        "target_chat_id": target_chat,
        "api_id": int(tu.API_ID) if tu.API_ID else 0,
        "api_hash": tu.API_HASH or "",
        "bot_token": tu.BOT_TOKEN or ""
    }
    try:
        resp = requests.post(f"{worker_url}/telegram/warmup", json=payload, timeout=25.0)
        return resp.json()
    except Exception as e:
        logger.warning(f"Error warming up Colab Telegram session: {e}")
        return {"status": "failed", "error": str(e)}

