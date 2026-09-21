import os
import asyncio
from typing import Any

try:
    asyncio.get_running_loop()
except RuntimeError:
    asyncio.set_event_loop(asyncio.new_event_loop())

import shutil
import pyrogram
from pyrogram import Client
from dotenv import load_dotenv
import logging

def reload_credentials():
    global API_ID, API_HASH, BOT_TOKEN, TARGET_CHAT_ID
    from .settings_manager import load_settings
    settings = load_settings()

    load_dotenv(override=True)
    data_dir_env = os.environ.get("UNLIM_CLOUT_DATA_DIR")
    if data_dir_env and os.path.exists(os.path.join(data_dir_env, ".env")):
        load_dotenv(os.path.join(data_dir_env, ".env"), override=True)

    # 1. API_ID & API_HASH default to official Telegram Android client credentials
    raw_api_id = os.getenv("API_ID") or settings.get("api_id") or 6
    try:
        API_ID = int(raw_api_id)
    except (ValueError, TypeError):
        API_ID = 6

    API_HASH = os.getenv("API_HASH") or settings.get("api_hash") or "eb06d4abfb49dc3eeb1aeb98ae0f581e"

    # 2. BOT_TOKEN and TARGET_CHAT_ID from settings or env
    BOT_TOKEN = (os.getenv("BOT_TOKEN") or settings.get("bot_token") or "").strip()
    raw_target_chat = os.getenv("TARGET_CHAT_ID") or settings.get("target_chat_id")
    if raw_target_chat:
        try:
            TARGET_CHAT_ID = int(str(raw_target_chat).strip())
        except (ValueError, TypeError):
            TARGET_CHAT_ID = str(raw_target_chat).strip()
    else:
        TARGET_CHAT_ID = None

def set_telegram_credentials(bot_token: str, target_chat_id: Any, api_id: int = 6, api_hash: str = "eb06d4abfb49dc3eeb1aeb98ae0f581e"):
    global API_ID, API_HASH, BOT_TOKEN, TARGET_CHAT_ID
    API_ID = api_id
    API_HASH = api_hash
    BOT_TOKEN = (bot_token or "").strip()
    if target_chat_id:
        try:
            TARGET_CHAT_ID = int(str(target_chat_id).strip())
        except (ValueError, TypeError):
            TARGET_CHAT_ID = str(target_chat_id).strip()
    else:
        TARGET_CHAT_ID = None

reload_credentials()

LIMIT_SIZE = 1984 * 1024 * 1024  # 1984MB in bytes

logger = logging.getLogger(__name__)

from pyrogram.handlers import MessageHandler

# We will initialize this during FastAPI lifespan
app: Client = None
found_event = asyncio.Event()

# Dictionary to track upload progress: upload_id -> dict
active_uploads = {}

# Dictionary to track upload asyncio tasks: upload_id -> asyncio.Task
active_upload_tasks = {}

# Dictionary to track download progress: download_id -> dict
active_downloads = {}

async def _progress(current, total, upload_id, offset, total_size):
    if upload_id:
        if active_uploads.get(upload_id, {}).get("cancelled"):
            raise pyrogram.StopTransmission("Upload cancelled by user")
        if upload_id not in active_uploads:
            active_uploads[upload_id] = {}
        active_uploads[upload_id].update({
            "current": current + offset,
            "total": total_size,
            "percent": ((current + offset) / total_size * 100) if total_size > 0 else 0
        })

async def _download_progress(current, total, download_id, offset, total_size):
    if download_id and download_id in active_downloads:
        if active_downloads[download_id].get("cancelled"):
            raise asyncio.CancelledError("Download cancelled by user")
        cumulative = offset + current
        tot = total_size if total_size and total_size > 0 else (offset + total)
        percent = round((cumulative / tot * 100), 1) if tot > 0 else 0
        active_downloads[download_id].update({
            "current": cumulative,
            "total": tot,
            "percent": min(99.9, percent),
            "status": "downloading"
        })

async def init_client():
    global app
    reload_credentials()

    if not BOT_TOKEN or not API_ID or not API_HASH:
        raise ValueError(
            "Telegram credentials missing: API_ID, API_HASH, or BOT_TOKEN is not set. "
            "Please check your .env configuration in %APPDATA%\\UnlimClout\\.env"
        )
    if not TARGET_CHAT_ID:
        raise ValueError("TARGET_CHAT_ID is missing in configuration.")
    
    def get_proxy():
        proxy_str = os.getenv("TELEGRAM_PROXY") or os.getenv("HTTPS_PROXY")
        if not proxy_str:
            return None
        try:
            from urllib.parse import urlparse
            p = urlparse(proxy_str)
            if not p.scheme or not p.hostname:
                return None
            pd = {
                "scheme": p.scheme.lower(),
                "hostname": p.hostname,
                "port": p.port or (1080 if "socks" in p.scheme else 8080)
            }
            if p.username:
                pd["username"] = p.username
            if p.password:
                pd["password"] = p.password
            return pd
        except Exception:
            return None

    session_workdir = os.environ.get("UNLIM_CLOUT_DATA_DIR", ".")
    app = Client(
        "cloud_storage_bot",
        workdir=session_workdir,
        api_id=API_ID,
        api_hash=API_HASH,
        bot_token=BOT_TOKEN,
        proxy=get_proxy()
    )

    
    async def capture_access_hash(client, message):
        if message.chat.id == TARGET_CHAT_ID:
            if message.text == "Init Session":
                print(f"\n[SUCCESS] Captured Access Hash for: {message.chat.title}")
                print("   [INFO] Deleting ping message...")
                try:
                    await message.delete()
                    print("   [SUCCESS] Message deleted successfully!")
                except Exception as e:
                    print(f"   [ERROR] Could not delete message: {e}")
            found_event.set()
            
    app.add_handler(MessageHandler(capture_access_hash))
    return app

async def disconnect_client():
    global app
    if app:
        try:
            if getattr(app, "is_connected", False):
                await asyncio.wait_for(app.stop(), timeout=3.0)
        except Exception as e:
            logger.warning(f"Error disconnecting client: {e}")
        finally:
            app = None

async def ensure_connection():
    try:
        await app.resolve_peer(TARGET_CHAT_ID)
        print("[SUCCESS] Bot is already connected and knows the Target Chat!")
        return
    except Exception:
        print(f"[INFO] Automatically connecting to channel {TARGET_CHAT_ID}...")
        found_event.clear()
        
        # Send an automated ping using the Bot API to force Pyrogram to learn the Access Hash
        loop = asyncio.get_running_loop()
        def send_ping():
            import urllib.request
            import urllib.parse
            import json
            url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
            data = json.dumps({"chat_id": TARGET_CHAT_ID, "text": "Init Session"}).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers={'Content-Type': 'application/json'})
            try:
                urllib.request.urlopen(req, timeout=8)
            except Exception as e:
                print(f"[ERROR] Auto-ping failed (is your VPN on?): {e}")

        loop.run_in_executor(None, send_ping)
        try:
            await asyncio.wait_for(found_event.wait(), timeout=10.0)
        except Exception:
            pass
        await app.resolve_peer(TARGET_CHAT_ID)



def split_file(original_file, base_filename: str = None):
    """Splits a large file into parts <= 1984MB exactly as per the notebook."""
    parts_folder = os.path.join(os.path.dirname(original_file), "Parts")
    os.makedirs(parts_folder, exist_ok=True)
    part_paths = []

    part_num = 1
    bytes_written = 0
    base_name = base_filename or os.path.basename(original_file)

    f = open(original_file, "rb")
    part_name = os.path.join(parts_folder, f"{base_name}.part{part_num:03d}")
    chunk_file = open(part_name, "wb")
    part_paths.append(part_name)

    while True:
        read_size = min(10 * 1024 * 1024, LIMIT_SIZE - bytes_written)
        chunk = f.read(read_size)

        if not chunk:
            break

        chunk_file.write(chunk)
        bytes_written += len(chunk)

        if bytes_written >= LIMIT_SIZE:
            chunk_file.close()
            part_num += 1
            part_name = os.path.join(parts_folder, f"{base_name}.part{part_num:03d}")
            chunk_file = open(part_name, "wb")
            part_paths.append(part_name)
            bytes_written = 0

    chunk_file.close()
    f.close()

    # Clean up the last part file if it is 0 bytes
    if os.path.getsize(part_paths[-1]) == 0:
        os.remove(part_paths[-1])
        part_paths.pop()

    return parts_folder, part_paths


def merge_parts(parts_folder, output_file):
    """Merges split files back together."""
    parts = sorted([f for f in os.listdir(parts_folder) if ".part" in f])
    
    with open(output_file, "wb") as outfile:
        for part in parts:
            part_path = os.path.join(parts_folder, part)
            with open(part_path, "rb") as infile:
                while True:
                    chunk = infile.read(10 * 1024 * 1024)
                    if not chunk:
                        break
                    outfile.write(chunk)


async def upload_file_to_telegram(file_path: str, upload_id: str = None, file_name: str = None) -> list[int]:
    """
    Uploads a file to Telegram with clean original filename.
    If it's > 1984MB, it splits it and uploads each part.
    Returns a list of message IDs.
    """
    if not TARGET_CHAT_ID:
        raise ValueError("TARGET_CHAT_ID is not configured.")

    file_size = os.path.getsize(file_path)
    message_ids = []

    clean_display_name = file_name or os.path.basename(file_path)
    if clean_display_name.startswith("upload_"):
        clean_display_name = clean_display_name[7:]
    elif clean_display_name.startswith("upl_") and "_" in clean_display_name[4:]:
        clean_display_name = clean_display_name.split("_", 2)[-1]
    
    if upload_id:
        if upload_id not in active_uploads:
            active_uploads[upload_id] = {}
        active_uploads[upload_id].update({
            "current": 0,
            "total": file_size,
            "percent": 0,
            "cancelled": active_uploads[upload_id].get("cancelled", False)
        })

    if upload_id and active_uploads.get(upload_id, {}).get("cancelled"):
        raise pyrogram.StopTransmission("Upload cancelled by user")

    try:
        if file_size <= LIMIT_SIZE:
            logger.info(f"Uploading file directly: {file_path} as '{clean_display_name}'")
            msg = await app.send_document(
                chat_id=TARGET_CHAT_ID,
                document=file_path,
                file_name=clean_display_name,
                progress=_progress,
                progress_args=(upload_id, 0, file_size)
            )
            message_ids.append(msg.id)
        else:
            logger.info(f"File > 1984MB. Splitting: {file_path}")
            parts_folder, part_paths = split_file(file_path, base_filename=clean_display_name)
            try:
                offset = 0
                for part_path in part_paths:
                    if upload_id and active_uploads.get(upload_id, {}).get("cancelled"):
                        raise pyrogram.StopTransmission("Upload cancelled by user")
                    part_display_name = os.path.basename(part_path)
                    logger.info(f"Uploading part: {part_path} as '{part_display_name}'")
                    msg = await app.send_document(
                        chat_id=TARGET_CHAT_ID,
                        document=part_path,
                        file_name=part_display_name,
                        progress=_progress,
                        progress_args=(upload_id, offset, file_size)
                    )
                    message_ids.append(msg.id)
                    offset += os.path.getsize(part_path)
            finally:
                logger.info("Cleaning up local parts...")
                shutil.rmtree(parts_folder, ignore_errors=True)

        if upload_id and active_uploads.get(upload_id, {}).get("cancelled"):
            if message_ids:
                try:
                    await delete_messages_from_telegram(message_ids)
                except Exception:
                    pass
            raise pyrogram.StopTransmission("Upload cancelled by user")

        return message_ids
    except (pyrogram.StopTransmission, asyncio.CancelledError) as e:
        logger.info(f"Upload {upload_id} cancelled or aborted: {e}")
        if message_ids:
            try:
                await delete_messages_from_telegram(message_ids)
            except Exception:
                pass
        raise

async def download_file_from_telegram(message_ids: list[int], output_path: str, download_id: str = None, total_size: int = 0):
    """
    Downloads a file or its parts from Telegram and merges them if necessary.
    Supports progress tracking via active_downloads[download_id].
    """
    if not message_ids:
        raise ValueError("No message IDs provided for download.")

    if download_id:
        if download_id not in active_downloads:
            active_downloads[download_id] = {}
        active_downloads[download_id].update({
            "status": "downloading",
            "current": 0,
            "total": total_size,
            "percent": 0,
            "tmp_path": output_path,
            "cancelled": False,
            "error": None
        })

    try:
        if len(message_ids) == 1:
            logger.info(f"Downloading single file message: {message_ids[0]}")
            msg = await app.get_messages(TARGET_CHAT_ID, message_ids[0])
            if download_id:
                await app.download_media(
                    msg,
                    file_name=output_path,
                    progress=_download_progress,
                    progress_args=(download_id, 0, total_size)
                )
            else:
                await app.download_media(msg, file_name=output_path)

            if download_id and download_id in active_downloads:
                active_downloads[download_id]["status"] = "ready"
                active_downloads[download_id]["percent"] = 100
                active_downloads[download_id]["current"] = total_size or (os.path.getsize(output_path) if os.path.exists(output_path) else 0)
        else:
            logger.info(f"Downloading {len(message_ids)} parts for: {output_path}")
            # Download all parts into a temporary folder
            parts_folder = output_path + "_parts"
            os.makedirs(parts_folder, exist_ok=True)
            if download_id and download_id in active_downloads:
                active_downloads[download_id]["parts_folder"] = parts_folder

            try:
                offset = 0
                for i, msg_id in enumerate(message_ids):
                    if download_id and active_downloads.get(download_id, {}).get("cancelled"):
                        raise asyncio.CancelledError("Download cancelled by user")

                    msg = await app.get_messages(TARGET_CHAT_ID, msg_id)
                    part_name = f"part_{i:03d}.part"
                    part_path = os.path.join(parts_folder, part_name)

                    if download_id:
                        await app.download_media(
                            msg,
                            file_name=part_path,
                            progress=_download_progress,
                            progress_args=(download_id, offset, total_size)
                        )
                    else:
                        await app.download_media(msg, file_name=part_path)

                    if os.path.exists(part_path):
                        offset += os.path.getsize(part_path)

                # All parts downloaded from Telegram! Transition to merging state
                if download_id and download_id in active_downloads:
                    active_downloads[download_id]["status"] = "merging"
                    active_downloads[download_id]["percent"] = 100

                logger.info("Merging downloaded parts...")
                await asyncio.to_thread(merge_parts, parts_folder, output_path)

                if download_id and download_id in active_downloads:
                    active_downloads[download_id]["status"] = "ready"
                    active_downloads[download_id]["percent"] = 100
                    active_downloads[download_id]["current"] = total_size or (os.path.getsize(output_path) if os.path.exists(output_path) else 0)
            finally:
                shutil.rmtree(parts_folder, ignore_errors=True)
    except asyncio.CancelledError:
        logger.info(f"Download {download_id} cancelled.")
        if download_id and download_id in active_downloads:
            active_downloads[download_id]["status"] = "cancelled"
        if os.path.exists(output_path):
            try:
                os.remove(output_path)
            except Exception:
                pass
        raise
    except Exception as e:
        logger.error(f"Download failed for {download_id}: {e}", exc_info=True)
        if download_id and download_id in active_downloads:
            active_downloads[download_id]["status"] = "failed"
            active_downloads[download_id]["error"] = str(e)
        if os.path.exists(output_path):
            try:
                os.remove(output_path)
            except Exception:
                pass
        raise

async def delete_messages_from_telegram(message_ids: list[int]):
    """Deletes messages from telegram (best-effort)."""
    if not message_ids:
        return
    try:
        global app
        if app is None:
            await init_client()
        if not app.is_connected:
            await app.start()
        await app.delete_messages(chat_id=TARGET_CHAT_ID, message_ids=message_ids)
    except Exception as e:
        logger.warning(f"Could not delete message(s) {message_ids} from Telegram (permission denied or already deleted): {e}")
