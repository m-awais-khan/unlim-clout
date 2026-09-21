import os
import shutil
import asyncio
import logging
import json
import uuid
import tempfile
import subprocess
from typing import List, Dict, Any, Optional

logger = logging.getLogger("transfer_engine")
logger.setLevel(logging.INFO)

LIMIT_SIZE = 1984 * 1024 * 1024  # 1984 MiB

def sanitize_error(err: Optional[str]) -> str:
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

class TransferEngine:
    def __init__(self):
        self.active_jobs: Dict[str, Dict[str, Any]] = {}
        self.running_processes: Dict[str, subprocess.Popen] = {}

    def cancel_job(self, job_id: str) -> bool:
        if job_id in self.active_jobs:
            self.active_jobs[job_id]["cancelled"] = True
            self.active_jobs[job_id]["status"] = "cancelled"

            # 1. Kill local colab exec subprocess
            proc = self.running_processes.get(job_id)
            if proc:
                try:
                    proc.kill()
                except Exception:
                    pass

            # 2. Send kernel interrupt to Colab runtime to immediately halt running cell
            try:
                from colab_cli.common import state
                from colab_cli.runtime import ColabRuntime
                from colab_utils import get_active_session_name
                name = get_active_session_name()
                s = state.store.get(name) if name else None
                if s:
                    try:
                        r = ColabRuntime(
                            url=s.url,
                            token=s.token,
                            session_name=s.name,
                            kernel_id=s.kernel_id,
                            session_id=s.session_id
                        )
                        r.kernel_client.interrupt()
                        logger.info(f"[{job_id}] Kernel interrupt sent to Colab session {s.name}")
                    except Exception as ke:
                        logger.warning(f"[{job_id}] KernelClient.interrupt failed ({ke}), restarting kernel...")
                        subprocess.run(["colab", "restart-kernel", "-s", s.name], timeout=10)
            except Exception as ie:
                logger.warning(f"[{job_id}] Error interrupting Colab kernel: {ie}")

            # 3. Clean up partial file and temp dirs on Colab Google Drive
            try:
                session_state, contents_client = self._get_colab_client()
                partial_path = self.active_jobs[job_id].get("partial_file_path")
                if partial_path:
                    # Strip leading /content/ to get relative path for ContentsClient
                    rel_path = partial_path.lstrip("/").replace("content/", "", 1)
                    try:
                        contents_client.rm(f"content/{rel_path}")
                        logger.info(f"[{job_id}] Cleaned up partial file on cancel: content/{rel_path}")
                    except Exception:
                        pass
                try:
                    contents_client.rm(f"content/clout_job_{job_id}.json")
                except Exception:
                    pass
                try:
                    contents_client.rm(f"content/tmp_dl_{job_id}")
                except Exception:
                    pass
                try:
                    contents_client.rm(f"content/tmp_upload_{job_id}")
                except Exception:
                    pass
            except Exception as ce:
                logger.warning(f"[{job_id}] Error cleaning up remote Colab files on cancel: {ce}")

            return True
        return False

    def _get_colab_client(self):
        from colab_cli.common import state
        from colab_cli.contents import ContentsClient
        from colab_utils import get_active_session_name
        name = get_active_session_name()
        s = state.store.get(name) if name else None
        if not s:
            raise RuntimeError("No active Google Colab session found. Please start a session in Settings.")
        c = ContentsClient(s)
        # Verify Google Drive is actually mounted on Colab
        try:
            data = c.list_dir("content/drive")
            items = data.get("content", [])
            if not any(item.get("name") == "MyDrive" for item in items):
                raise FileNotFoundError()
        except Exception:
            try:
                import colab_utils
                colab_utils._last_mount_check_result = False
                colab_utils._last_mount_check_time = 0.0
            except Exception:
                pass
            raise RuntimeError("Google Drive is not mounted in Colab. Please mount Google Drive in Settings before transferring files.")
        return s, c

    async def upload_drive_file_to_telegram(
        self,
        job_id: str,
        drive_file_path: str,
        target_chat_id: Any,
        api_id: int,
        api_hash: str,
        bot_token: str
    ) -> List[int]:
        """
        Uploads a file from Google Drive to Telegram using Google Colab.
        """
        clean_p = (drive_file_path or "").strip()
        if not clean_p.startswith("/content/drive/MyDrive/"):
            clean_rel = clean_p.lstrip("/\\").replace("content/drive/MyDrive/", "").replace("MyDrive/", "")
            clean_p = f"/content/drive/MyDrive/{clean_rel}"
        drive_file_path = clean_p

        file_name = os.path.basename(drive_file_path)
        self.active_jobs[job_id] = {
            "status": "pending",
            "job_type": "drive_to_telegram",
            "file_name": file_name,
            "total_bytes": 0,
            "transferred_bytes": 0,
            "current_part": 0,
            "total_parts": 1,
            "percent": 0,
            "cancelled": False,
            "error": None,
            "message_ids": []
        }

        try:
            session_state, contents_client = self._get_colab_client()
        except Exception as e:
            err_msg = sanitize_error(str(e))
            self.active_jobs[job_id].update({"status": "failed", "error": err_msg})
            raise RuntimeError(err_msg)

        # Parse numeric chat_id
        try:
            parsed_chat_id = int(target_chat_id)
        except (ValueError, TypeError):
            parsed_chat_id = target_chat_id

        # Python script executed on Colab VM
        colab_script = f"""
import os
import sys
import json
import time
import asyncio
import subprocess
import shutil

# Ensure dependencies installed
try:
    import pyrogram
    import nest_asyncio
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pyrogram", "tgcrypto", "requests", "nest_asyncio"])
    import pyrogram
    import nest_asyncio

import nest_asyncio
nest_asyncio.apply()

from pyrogram import Client, handlers

JOB_ID = {json.dumps(job_id)}
DRIVE_PATH = {json.dumps(drive_file_path)}
TARGET_CHAT_ID = {json.dumps(parsed_chat_id)}
API_ID = {int(api_id)}
API_HASH = {json.dumps(api_hash)}
BOT_TOKEN = {json.dumps(bot_token)}
LIMIT_SIZE = 1984 * 1024 * 1024
STATUS_FILE = f"/content/clout_job_{{JOB_ID}}.json"

def write_status(data):
    try:
        tmp_file = f"{{STATUS_FILE}}.tmp"
        with open(tmp_file, "w") as f:
            json.dump(data, f)
        os.replace(tmp_file, STATUS_FILE)
    except Exception as e:
        print(f"Error writing status: {{e}}")

async def ensure_peer(app, chat_id, token):
    try:
        await app.resolve_peer(chat_id)
        print(f"Peer {{chat_id}} already resolved.")
        return
    except Exception as e:
        print(f"Peer not cached ({{e}}). Performing automated handshake...")

    found = asyncio.Event()
    async def on_msg(client, message):
        if message.chat and message.chat.id == chat_id:
            try:
                await message.delete()
            except Exception:
                pass
            found.set()

    h = app.add_handler(handlers.MessageHandler(on_msg))

    def ping():
        import urllib.request
        url = f"https://api.telegram.org/bot{{token}}/sendMessage"
        payload = json.dumps({{"chat_id": chat_id, "text": "⚡ Clout Session Ping"}}).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={{"Content-Type": "application/json"}})
        try:
            urllib.request.urlopen(req, timeout=10)
        except Exception as pe:
            print(f"Ping failed: {{pe}}")

    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, ping)

    try:
        await asyncio.wait_for(found.wait(), timeout=12.0)
    except Exception:
        pass
    finally:
        try:
            app.remove_handler(*h)
        except Exception:
            pass

    await app.resolve_peer(chat_id)

async def main():
    target_path = DRIVE_PATH
    if not os.path.isfile(target_path):
        clean_rel = DRIVE_PATH.lstrip("/").replace("content/drive/MyDrive/", "").replace("MyDrive/", "")
        alt_path = os.path.join("/content/drive/MyDrive", clean_rel)
        if os.path.isfile(alt_path):
            target_path = alt_path
        else:
            write_status({{"status": "failed", "error": "File not found in Google Drive: " + str(DRIVE_PATH)}})
            return

    file_size = os.path.getsize(target_path)
    file_name = os.path.basename(target_path)
    total_parts = 1 if file_size <= LIMIT_SIZE else ((file_size + LIMIT_SIZE - 1) // LIMIT_SIZE)

    write_status({{
        "status": "connecting",
        "file_name": file_name,
        "total_bytes": file_size,
        "transferred_bytes": 0,
        "current_part": 1,
        "total_parts": total_parts,
        "percent": 0
    }})

    app = Client("clout_colab_telegram", api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN, workdir="/content")
    await app.start()

    try:
        await app.resolve_peer(TARGET_CHAT_ID)
    except Exception:
        await ensure_peer(app, TARGET_CHAT_ID, BOT_TOKEN)

    write_status({{
        "status": "transferring",
        "file_name": file_name,
        "total_bytes": file_size,
        "transferred_bytes": 0,
        "current_part": 1,
        "total_parts": total_parts,
        "percent": 0
    }})

    last_update = [0]
    def progress_cb(current, total, offset):
        now = time.time()
        if now - last_update[0] >= 0.8 or (offset + current) >= file_size:
            last_update[0] = now
            cum = offset + current
            pct = round((cum / file_size * 100), 1) if file_size > 0 else 0
            write_status({{
                "status": "transferring",
                "file_name": file_name,
                "total_bytes": file_size,
                "transferred_bytes": cum,
                "current_part": 1 if total_parts == 1 else (offset // LIMIT_SIZE + 1),
                "total_parts": total_parts,
                "percent": min(99.9, pct)
            }})

    message_ids = []
    tmp_dir = f"/content/tmp_upload_{{JOB_ID}}"
    os.makedirs(tmp_dir, exist_ok=True)

    try:
        if file_size <= LIMIT_SIZE:
            msg = await app.send_document(
                chat_id=TARGET_CHAT_ID,
                document=target_path,
                progress=progress_cb,
                progress_args=(0,)
            )
            message_ids.append(msg.id)
        else:
            with open(target_path, "rb") as src:
                offset = 0
                for part_num in range(1, total_parts + 1):
                    part_name = f"{{file_name}}.part{{part_num:03d}}"
                    part_path = os.path.join(tmp_dir, part_name)
                    bytes_to_read = min(LIMIT_SIZE, file_size - offset)
                    written = 0
                    with open(part_path, "wb") as chunk_f:
                        while written < bytes_to_read:
                            chunk = src.read(min(10 * 1024 * 1024, bytes_to_read - written))
                            if not chunk:
                                break
                            chunk_f.write(chunk)
                            written += len(chunk)

                    msg = await app.send_document(
                        chat_id=TARGET_CHAT_ID,
                        document=part_path,
                        progress=progress_cb,
                        progress_args=(offset,)
                    )
                    message_ids.append(msg.id)
                    offset += written
                    if os.path.exists(part_path):
                        os.remove(part_path)

        res_payload = {{
            "status": "completed",
            "file_name": file_name,
            "total_bytes": file_size,
            "transferred_bytes": file_size,
            "percent": 100,
            "message_ids": message_ids
        }}
        write_status(res_payload)
        print("__CLOUT_JOB_RESULT__" + json.dumps(res_payload))
    except (KeyboardInterrupt, asyncio.CancelledError):
        print("Upload job cancelled by user")
        write_status({{
            "status": "cancelled",
            "file_name": file_name,
            "total_bytes": file_size,
            "transferred_bytes": 0,
            "percent": 0
        }})
        return
    finally:
        try:
            await app.stop()
        except Exception:
            pass
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass

if __name__ == "__main__":
    try:
        loop = asyncio.get_event_loop()
        loop.run_until_complete(main())
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    except Exception as e:
        write_status({{"status": "failed", "error": str(e)}})
"""

        try:
            return await self._execute_and_monitor_colab_job(
                job_id=job_id,
                session_name=session_state.name,
                contents_client=contents_client,
                colab_script=colab_script
            )
        except Exception as e:
            logger.exception(f"[{job_id}] Drive to Telegram upload failed: {e}")
            err_msg = sanitize_error(str(e))
            self.active_jobs[job_id].update({"status": "failed", "error": err_msg})
            raise RuntimeError(err_msg)

    async def upload_drive_folder_to_telegram(
        self,
        job_id: str,
        drive_folder_path: str,
        target_chat_id: Any,
        api_id: int,
        api_hash: str,
        bot_token: str
    ) -> Dict[str, Any]:
        """
        Recursively uploads an entire folder from Google Drive to Telegram using Google Colab.
        Files are uploaded sequentially in a loop. For files > 1984 MiB, split parts are generated
        and uploaded, then immediately deleted from VM storage, enabling folders of arbitrary total size
        to be transferred without filling Colab's VM disk.
        """
        clean_p = (drive_folder_path or "").strip()
        if not clean_p.startswith("/content/drive/MyDrive/"):
            clean_rel = clean_p.lstrip("/\\").replace("content/drive/MyDrive/", "").replace("MyDrive/", "")
            clean_p = f"/content/drive/MyDrive/{clean_rel}"
        drive_folder_path = clean_p.rstrip("/")

        folder_name = os.path.basename(drive_folder_path) or "Folder"
        self.active_jobs[job_id] = {
            "status": "pending",
            "job_type": "drive_folder_to_telegram",
            "folder_name": folder_name,
            "total_bytes": 0,
            "transferred_bytes": 0,
            "total_files": 0,
            "completed_files": 0,
            "current_file": "",
            "percent": 0,
            "cancelled": False,
            "error": None,
            "manifest": []
        }

        try:
            session_state, contents_client = self._get_colab_client()
        except Exception as e:
            err_msg = sanitize_error(str(e))
            self.active_jobs[job_id].update({"status": "failed", "error": err_msg})
            raise RuntimeError(err_msg)

        try:
            parsed_chat_id = int(target_chat_id)
        except (ValueError, TypeError):
            parsed_chat_id = target_chat_id

        try:
            # Python script executed on Colab VM
            colab_script = f"""
import os
import sys
import json
import time
import asyncio
import subprocess
import shutil

# Ensure dependencies installed
try:
    import pyrogram
    import nest_asyncio
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pyrogram", "tgcrypto", "requests", "nest_asyncio"])
    import pyrogram
    import nest_asyncio

import nest_asyncio
nest_asyncio.apply()

from pyrogram import Client, handlers

JOB_ID = {json.dumps(job_id)}
DRIVE_FOLDER_PATH = {json.dumps(drive_folder_path)}
TARGET_CHAT_ID = {json.dumps(parsed_chat_id)}
API_ID = {int(api_id)}
API_HASH = {json.dumps(api_hash)}
BOT_TOKEN = {json.dumps(bot_token)}
LIMIT_SIZE = 1984 * 1024 * 1024
STATUS_FILE = f"/content/clout_job_{{JOB_ID}}.json"

def write_status(data):
    try:
        tmp_file = f"{{STATUS_FILE}}.tmp"
        with open(tmp_file, "w") as f:
            json.dump(data, f)
        os.replace(tmp_file, STATUS_FILE)
    except Exception as e:
        print(f"Error writing status: {{e}}")


async def ensure_peer(app, chat_id, token):
    try:
        await app.resolve_peer(chat_id)
        return
    except Exception:
        pass

    found = asyncio.Event()
    async def on_msg(client, message):
        if message.chat and message.chat.id == chat_id:
            try:
                await message.delete()
            except Exception:
                pass
            found.set()

    h = app.add_handler(handlers.MessageHandler(on_msg))

    def ping():
        import urllib.request
        url = f"https://api.telegram.org/bot{{token}}/sendMessage"
        payload = json.dumps({{"chat_id": chat_id, "text": "⚡ Clout Session Ping"}}).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={{"Content-Type": "application/json"}})
        try:
            urllib.request.urlopen(req, timeout=10)
        except Exception:
            pass

    loop = asyncio.get_running_loop()
    loop.run_in_executor(None, ping)

    try:
        await asyncio.wait_for(found.wait(), timeout=12.0)
    except Exception:
        pass
    finally:
        try:
            app.remove_handler(*h)
        except Exception:
            pass

    await app.resolve_peer(chat_id)

async def main():
    target_folder = DRIVE_FOLDER_PATH
    if not os.path.isdir(target_folder):
        clean_rel = DRIVE_FOLDER_PATH.lstrip("/").replace("content/drive/MyDrive/", "").replace("MyDrive/", "")
        alt_path = os.path.join("/content/drive/MyDrive", clean_rel)
        if os.path.isdir(alt_path):
            target_folder = alt_path
        else:
            write_status({{"status": "failed", "error": "Folder not found in Google Drive: " + str(DRIVE_FOLDER_PATH)}})
            return

    # Collect all files recursively
    all_files = []
    total_folder_bytes = 0
    for root, dirs, files in os.walk(target_folder):
        dirs.sort()
        files.sort()
        for file_name in files:
            p = os.path.join(root, file_name)
            try:
                sz = os.path.getsize(p)
                total_folder_bytes += sz
                all_files.append((p, file_name, sz))
            except Exception:
                pass

    folder_name = os.path.basename(target_folder.rstrip("/"))
    total_files = len(all_files)

    if not all_files:
        write_status({{"status": "failed", "error": "Selected folder is empty or has no accessible files."}})
        return

    write_status({{
        "status": "connecting",
        "folder_name": folder_name,
        "total_files": total_files,
        "completed_files": 0,
        "current_file": all_files[0][1],
        "total_bytes": total_folder_bytes,
        "transferred_bytes": 0,
        "percent": 0
    }})

    app = Client("clout_colab_telegram", api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN, workdir="/content")
    await app.start()

    try:
        await app.resolve_peer(TARGET_CHAT_ID)
    except Exception:
        await ensure_peer(app, TARGET_CHAT_ID, BOT_TOKEN)

    cum_bytes = [0]
    last_update = [0]

    def make_progress_cb(f_name, file_idx):
        def progress_cb(current, total):
            now = time.time()
            transferred = cum_bytes[0] + current
            if now - last_update[0] >= 0.8 or current >= total:
                last_update[0] = now
                pct = round((transferred / total_folder_bytes * 100), 1) if total_folder_bytes > 0 else 0
                write_status({{
                    "status": "transferring",
                    "folder_name": folder_name,
                    "total_files": total_files,
                    "completed_files": file_idx,
                    "current_file": f_name,
                    "total_bytes": total_folder_bytes,
                    "transferred_bytes": transferred,
                    "percent": min(99.9, pct)
                }})
        return progress_cb

    manifest = []
    tmp_dir = f"/content/tmp_upload_{{JOB_ID}}"
    os.makedirs(tmp_dir, exist_ok=True)

    try:
        for idx, (f_path, f_name, f_size) in enumerate(all_files):
            rel_path = os.path.relpath(f_path, target_folder).replace("\\\\", "/")
            file_msg_ids = []

            write_status({{
                "status": "transferring",
                "folder_name": folder_name,
                "total_files": total_files,
                "completed_files": idx,
                "current_file": f_name,
                "total_bytes": total_folder_bytes,
                "transferred_bytes": cum_bytes[0],
                "percent": min(99.9, round((cum_bytes[0] / total_folder_bytes * 100), 1)) if total_folder_bytes > 0 else 0
            }})

            if f_size <= LIMIT_SIZE:
                cb = make_progress_cb(f_name, idx)
                msg = await app.send_document(
                    chat_id=TARGET_CHAT_ID,
                    document=f_path,
                    file_name=f_name,
                    progress=cb
                )
                file_msg_ids.append(msg.id)
                cum_bytes[0] += f_size
            else:
                # File > 2GB: Split into local parts, upload parts, delete parts immediately!
                parts_dir = os.path.join(tmp_dir, f"parts_{{idx}}")
                os.makedirs(parts_dir, exist_ok=True)
                part_paths = []
                part_num = 1
                bytes_written = 0

                with open(f_path, "rb") as src:
                    part_name = os.path.join(parts_dir, f"{{f_name}}.part{{part_num:03d}}")
                    part_paths.append(part_name)
                    chunk_f = open(part_name, "wb")
                    while True:
                        read_size = min(10 * 1024 * 1024, LIMIT_SIZE - bytes_written)
                        chunk = src.read(read_size)
                        if not chunk:
                            break
                        chunk_f.write(chunk)
                        bytes_written += len(chunk)
                        if bytes_written >= LIMIT_SIZE:
                            chunk_f.close()
                            part_num += 1
                            part_name = os.path.join(parts_dir, f"{{f_name}}.part{{part_num:03d}}")
                            chunk_f = open(part_name, "wb")
                            part_paths.append(part_name)
                            bytes_written = 0
                    chunk_f.close()

                if os.path.exists(part_paths[-1]) and os.path.getsize(part_paths[-1]) == 0:
                    os.remove(part_paths[-1])
                    part_paths.pop()

                for part_path in part_paths:
                    p_name = os.path.basename(part_path)
                    p_sz = os.path.getsize(part_path)
                    cb = make_progress_cb(p_name, idx)
                    msg = await app.send_document(
                        chat_id=TARGET_CHAT_ID,
                        document=part_path,
                        file_name=p_name,
                        progress=cb
                    )
                    file_msg_ids.append(msg.id)
                    cum_bytes[0] += p_sz

                # Crucial step: immediately delete local parts from VM to free storage!
                shutil.rmtree(parts_dir, ignore_errors=True)

            manifest.append({{
                "rel_path": rel_path,
                "filename": f_name,
                "file_size": f_size,
                "message_ids": file_msg_ids
            }})

        res_payload = {{
            "status": "completed",
            "folder_name": folder_name,
            "total_files": total_files,
            "completed_files": total_files,
            "total_bytes": total_folder_bytes,
            "transferred_bytes": total_folder_bytes,
            "percent": 100,
            "manifest": manifest
        }}
        write_status(res_payload)
        print("__CLOUT_JOB_RESULT__" + json.dumps(res_payload))

    except (KeyboardInterrupt, asyncio.CancelledError):
        print("Folder upload job cancelled by user")
        write_status({{
            "status": "cancelled",
            "folder_name": folder_name,
            "total_files": total_files,
            "total_bytes": total_folder_bytes,
            "transferred_bytes": 0,
            "percent": 0
        }})
        return
    finally:
        try:
            await app.stop()
        except Exception:
            pass
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass

if __name__ == "__main__":
    try:
        loop = asyncio.get_event_loop()
        loop.run_until_complete(main())
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    except Exception as e:
        write_status({{"status": "failed", "error": str(e)}})
"""

            return await self._execute_and_monitor_colab_job(
                job_id=job_id,
                session_name=session_state.name,
                contents_client=contents_client,
                colab_script=colab_script
            )
        except Exception as e:
            logger.exception(f"[{job_id}] Drive folder upload failed: {e}")
            err_msg = sanitize_error(str(e))
            self.active_jobs[job_id].update({"status": "failed", "error": err_msg})
            raise RuntimeError(err_msg)

    async def download_telegram_to_drive(
        self,
        job_id: str,
        message_ids: List[int],
        destination_drive_dir: str,
        final_filename: str,
        total_size: int,
        target_chat_id: Any,
        api_id: int,
        api_hash: str,
        bot_token: str
    ) -> str:
        """
        Downloads files from Telegram directly into mounted Google Drive on Colab.
        """
        self.active_jobs[job_id] = {
            "status": "pending",
            "job_type": "telegram_to_drive",
            "file_name": final_filename,
            "total_bytes": total_size,
            "transferred_bytes": 0,
            "current_part": 0,
            "total_parts": len(message_ids),
            "percent": 0,
            "cancelled": False,
            "error": None
        }

        try:
            session_state, contents_client = self._get_colab_client()
        except Exception as e:
            err_msg = sanitize_error(str(e))
            self.active_jobs[job_id].update({"status": "failed", "error": err_msg})
            raise RuntimeError(err_msg)

        try:
            parsed_chat_id = int(target_chat_id)
        except (ValueError, TypeError):
            parsed_chat_id = target_chat_id

        # Normalize destination path so it is always strictly inside /content/drive/MyDrive
        raw_dest = (destination_drive_dir or "").strip()
        if not raw_dest or raw_dest in ("/", "My Drive"):
            final_dest_dir = "/content/drive/MyDrive"
        elif raw_dest.startswith("/content/drive/MyDrive"):
            final_dest_dir = raw_dest.rstrip("/")
        else:
            sub = raw_dest.strip("/\\")
            final_dest_dir = f"/content/drive/MyDrive/{sub}".rstrip("/")

        # Track destination file so cancel_job can immediately delete it if interrupted
        self.active_jobs[job_id]["partial_file_path"] = f"{final_dest_dir}/{final_filename}"

        # Python script executed on Colab VM
        colab_script = f"""
import os
import sys
import json
import time
import asyncio
import subprocess
import shutil

try:
    import pyrogram
    import nest_asyncio
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pyrogram", "tgcrypto", "requests", "nest_asyncio"])
    import pyrogram
    import nest_asyncio

import nest_asyncio
nest_asyncio.apply()

from pyrogram import Client, handlers

JOB_ID = {json.dumps(job_id)}
MESSAGE_IDS = {json.dumps(message_ids)}
DEST_DIR = {json.dumps(final_dest_dir)}
FINAL_FILENAME = {json.dumps(final_filename)}
TOTAL_SIZE = {int(total_size)}
TARGET_CHAT_ID = {json.dumps(parsed_chat_id)}
API_ID = {int(api_id)}
API_HASH = {json.dumps(api_hash)}
BOT_TOKEN = {json.dumps(bot_token)}
STATUS_FILE = f"/content/clout_job_{{JOB_ID}}.json"

def write_status(data):
    try:
        tmp_file = f"{{STATUS_FILE}}.tmp"
        with open(tmp_file, "w") as f:
            json.dump(data, f)
        os.replace(tmp_file, STATUS_FILE)
    except Exception as e:
        print(f"Error writing status: {{e}}")

async def ensure_peer(app, chat_id, token):
    try:
        await app.resolve_peer(chat_id)
        print(f"Peer {{chat_id}} already resolved.")
        return
    except Exception as e:
        print(f"Handshake required for {{chat_id}} ({{e}})...")

    found = asyncio.Event()
    async def on_msg(client, message):
        if message.chat and message.chat.id == chat_id:
            try:
                await message.delete()
            except Exception:
                pass
            found.set()

    h = app.add_handler(handlers.MessageHandler(on_msg))
    def ping():
        import urllib.request
        url = f"https://api.telegram.org/bot{{token}}/sendMessage"
        payload = json.dumps({{"chat_id": chat_id, "text": "⚡ Clout Session Ping"}}).encode("utf-8")
        req = urllib.request.Request(url, data=payload, headers={{"Content-Type": "application/json"}})
        try:
            urllib.request.urlopen(req, timeout=10)
        except Exception:
            pass

    asyncio.get_running_loop().run_in_executor(None, ping)
    try:
        await asyncio.wait_for(found.wait(), timeout=12.0)
    except Exception:
        pass
    finally:
        try:
            app.remove_handler(*h)
        except Exception:
            pass
    await app.resolve_peer(chat_id)

async def main():
    os.makedirs(DEST_DIR, exist_ok=True)
    final_output_path = os.path.join(DEST_DIR, FINAL_FILENAME)

    app = Client("clout_colab_telegram", api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN, workdir="/content")
    await app.start()

    try:
        await app.resolve_peer(TARGET_CHAT_ID)
    except Exception:
        write_status({{
            "status": "connecting",
            "file_name": FINAL_FILENAME,
            "total_bytes": TOTAL_SIZE,
            "transferred_bytes": 0,
            "current_part": 1,
            "total_parts": len(MESSAGE_IDS),
            "percent": 0
        }})
        await ensure_peer(app, TARGET_CHAT_ID, BOT_TOKEN)

    write_status({{
        "status": "downloading",
        "file_name": FINAL_FILENAME,
        "total_bytes": TOTAL_SIZE,
        "transferred_bytes": 0,
        "current_part": 1,
        "total_parts": len(MESSAGE_IDS),
        "percent": 0
    }})

    last_update = [0]
    def progress_cb(current, total, offset):
        now = time.time()
        if now - last_update[0] >= 0.8 or (offset + current) >= TOTAL_SIZE:
            last_update[0] = now
            cum = offset + current
            pct = round((cum / TOTAL_SIZE * 100), 1) if TOTAL_SIZE > 0 else 0
            write_status({{
                "status": "downloading",
                "file_name": FINAL_FILENAME,
                "total_bytes": TOTAL_SIZE,
                "transferred_bytes": cum,
                "current_part": 1 if len(MESSAGE_IDS) == 1 else (offset // (TOTAL_SIZE // len(MESSAGE_IDS)) + 1),
                "total_parts": len(MESSAGE_IDS),
                "percent": min(99.9, pct)
            }})

    tmp_dir = f"/content/tmp_dl_{{JOB_ID}}"
    os.makedirs(tmp_dir, exist_ok=True)

    try:
        if len(MESSAGE_IDS) == 1:
            msg = await app.get_messages(TARGET_CHAT_ID, MESSAGE_IDS[0])
            await app.download_media(
                msg,
                file_name=final_output_path,
                progress=progress_cb,
                progress_args=(0,)
            )
        else:
            offset = 0
            part_files = []
            for i, mid in enumerate(MESSAGE_IDS):
                msg = await app.get_messages(TARGET_CHAT_ID, mid)
                part_path = os.path.join(tmp_dir, f"part_{{i:03d}}.part")
                await app.download_media(
                    msg,
                    file_name=part_path,
                    progress=progress_cb,
                    progress_args=(offset,)
                )
                if os.path.exists(part_path):
                    offset += os.path.getsize(part_path)
                    part_files.append(part_path)

            write_status({{
                "status": "merging",
                "file_name": FINAL_FILENAME,
                "total_bytes": TOTAL_SIZE,
                "transferred_bytes": TOTAL_SIZE,
                "percent": 99.0
            }})

            with open(final_output_path, "wb") as out_f:
                for p_path in part_files:
                    with open(p_path, "rb") as in_f:
                        while True:
                            buf = in_f.read(10 * 1024 * 1024)
                            if not buf:
                                break
                            out_f.write(buf)
                    os.remove(p_path)

        try:
            os.sync()
        except Exception:
            pass

        actual_size = os.path.getsize(final_output_path) if os.path.exists(final_output_path) else TOTAL_SIZE
        res_payload = {{
            "status": "completed",
            "file_name": FINAL_FILENAME,
            "total_bytes": actual_size,
            "transferred_bytes": actual_size,
            "percent": 100,
            "destination_path": final_output_path
        }}
        write_status(res_payload)
        print("__CLOUT_JOB_RESULT__" + json.dumps(res_payload))
    except (KeyboardInterrupt, asyncio.CancelledError):
        print("Download job cancelled by user")
        write_status({{
            "status": "cancelled",
            "file_name": FINAL_FILENAME,
            "total_bytes": TOTAL_SIZE,
            "transferred_bytes": 0,
            "percent": 0
        }})
        if os.path.exists(final_output_path):
            try:
                os.remove(final_output_path)
            except Exception:
                pass
        return
    finally:
        try:
            await app.stop()
        except Exception:
            pass
        try:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        except Exception:
            pass

if __name__ == "__main__":
    try:
        loop = asyncio.get_event_loop()
        loop.run_until_complete(main())
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    except Exception as e:
        write_status({{"status": "failed", "error": str(e)}})
"""

        try:
            return await self._execute_and_monitor_colab_job(
                job_id=job_id,
                session_name=session_state.name,
                contents_client=contents_client,
                colab_script=colab_script
            )
        except Exception as e:
            logger.exception(f"[{job_id}] Telegram to Drive download failed: {e}")
            err_msg = sanitize_error(str(e))
            self.active_jobs[job_id].update({"status": "failed", "error": err_msg})
            raise RuntimeError(err_msg)

    async def _execute_and_monitor_colab_job(
        self,
        job_id: str,
        session_name: str,
        contents_client,
        colab_script: str
    ):
        """
        Executes a script on the remote Colab session and polls progress.
        """
        script_file = f"/tmp/clout_{job_id}.py"
        remote_status_path = f"content/clout_job_{job_id}.json"
        local_status_tmp = f"/tmp/clout_status_{job_id}.json"

        with open(script_file, "w", encoding="utf-8") as f:
            f.write(colab_script)

        # Launch colab exec in a subprocess with 86400s (24h) timeout to prevent premature cuts on large transfers
        cmd = ["colab", "exec", "-s", session_name, "-f", script_file, "--timeout", "86400"]
        logger.info(f"[{job_id}] Launching remote Colab execution: {' '.join(cmd)}")

        proc = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        self.running_processes[job_id] = proc

        # Polling loop
        final_result = None
        while proc.returncode is None:
            await asyncio.sleep(1.0)
            if self.active_jobs[job_id].get("cancelled"):
                try:
                    proc.kill()
                except Exception:
                    pass
                break

            # Try to read status file from Colab
            try:
                await asyncio.to_thread(contents_client.download, remote_status_path, local_status_tmp)
                with open(local_status_tmp, "r") as sf:
                    remote_data = json.load(sf)
                    self.active_jobs[job_id].update({
                        "status": remote_data.get("status", self.active_jobs[job_id]["status"]),
                        "percent": remote_data.get("percent", self.active_jobs[job_id]["percent"]),
                        "transferred_bytes": remote_data.get("transferred_bytes", self.active_jobs[job_id]["transferred_bytes"]),
                        "total_bytes": remote_data.get("total_bytes", self.active_jobs[job_id]["total_bytes"]),
                        "current_part": remote_data.get("current_part", self.active_jobs[job_id].get("current_part", 1)),
                        "total_parts": remote_data.get("total_parts", self.active_jobs[job_id].get("total_parts", 1)),
                        "completed_files": remote_data.get("completed_files", self.active_jobs[job_id].get("completed_files", 0)),
                        "total_files": remote_data.get("total_files", self.active_jobs[job_id].get("total_files", 0)),
                        "current_file": remote_data.get("current_file", self.active_jobs[job_id].get("current_file", "")),
                    })
                    if remote_data.get("message_ids"):
                        self.active_jobs[job_id]["message_ids"] = remote_data["message_ids"]
                    if remote_data.get("manifest"):
                        self.active_jobs[job_id]["manifest"] = remote_data["manifest"]

                    if remote_data.get("status") in ("completed", "failed"):
                        final_result = remote_data
                        break
            except Exception:
                # File not created yet or busy
                pass

        # Wait for colab exec process to complete
        stdout, stderr = await proc.communicate()
        out_str = stdout.decode("utf-8", errors="ignore")
        err_str = stderr.decode("utf-8", errors="ignore")
        logger.info(f"[{job_id}] Colab exec finished. RC: {proc.returncode}")

        # Check stdout first for the definitive result
        if "__CLOUT_JOB_RESULT__" in out_str:
            try:
                json_part = out_str.split("__CLOUT_JOB_RESULT__")[1].strip().split("\n")[0]
                final_result = json.loads(json_part)
            except Exception as e:
                logger.warning(f"Failed to parse job result from stdout: {e}")

        # Final check of status from file if not parsed
        if not final_result:
            try:
                contents_client.download(remote_status_path, local_status_tmp)
                with open(local_status_tmp, "r") as sf:
                    final_result = json.load(sf)
            except Exception:
                pass

        # Clean up local & remote files
        try:
            contents_client.rm(remote_status_path)
        except Exception:
            pass
        if os.path.exists(script_file):
            try:
                os.remove(script_file)
            except Exception:
                pass
        if os.path.exists(local_status_tmp):
            try:
                os.remove(local_status_tmp)
            except Exception:
                pass
        self.running_processes.pop(job_id, None)

        # If Colab process finished with code 0 and reached completed or made progress
        if proc.returncode == 0:
            if final_result and final_result.get("status") == "completed":
                self.active_jobs[job_id].update({
                    "status": "completed",
                    "percent": 100,
                    "transferred_bytes": final_result.get("transferred_bytes", self.active_jobs[job_id]["total_bytes"]),
                    "message_ids": final_result.get("message_ids", []),
                    "manifest": final_result.get("manifest", self.active_jobs[job_id].get("manifest", []))
                })
                return final_result.get("manifest") or final_result.get("destination_path") or final_result.get("message_ids", [])
            elif not (final_result and final_result.get("status") == "failed"):
                self.active_jobs[job_id].update({
                    "status": "completed",
                    "percent": 100,
                    "transferred_bytes": self.active_jobs[job_id]["total_bytes"],
                    "message_ids": self.active_jobs[job_id].get("message_ids", []),
                    "manifest": self.active_jobs[job_id].get("manifest", [])
                })
                return self.active_jobs[job_id].get("manifest") or self.active_jobs[job_id].get("destination_path") or self.active_jobs[job_id].get("message_ids", [])

        # Failed or cancelled
        error_msg = None
        if final_result and final_result.get("error"):
            error_msg = sanitize_error(final_result["error"])
        elif proc.returncode != 0:
            error_msg = sanitize_error(err_str or out_str or "Colab transfer execution failed")

        if not self.active_jobs[job_id].get("cancelled"):
            self.active_jobs[job_id]["status"] = "failed"
            self.active_jobs[job_id]["error"] = error_msg or "Transfer failed unexpectedly"
            raise RuntimeError(self.active_jobs[job_id]["error"])

        return None

    async def warmup_telegram_session(
        self,
        target_chat_id: Any,
        api_id: int,
        api_hash: str,
        bot_token: str
    ) -> Dict[str, Any]:
        """
        Connects and verifies/establishes persistent Telegram session on Colab once.
        """
        try:
            session_state, contents_client = self._get_colab_client()
        except Exception as e:
            return {"status": "failed", "error": sanitize_error(str(e))}

        try:
            parsed_chat_id = int(target_chat_id)
        except (ValueError, TypeError):
            parsed_chat_id = target_chat_id

        warmup_script = f"""
import os
import sys
import json
import asyncio
import subprocess

try:
    import pyrogram
    import nest_asyncio
except ImportError:
    subprocess.run([sys.executable, "-m", "pip", "install", "-q", "pyrogram", "tgcrypto", "requests", "nest_asyncio"])
    import pyrogram
    import nest_asyncio

import nest_asyncio
nest_asyncio.apply()

from pyrogram import Client, handlers

TARGET_CHAT_ID = {json.dumps(parsed_chat_id)}
API_ID = {int(api_id)}
API_HASH = {json.dumps(api_hash)}
BOT_TOKEN = {json.dumps(bot_token)}

async def main():
    app = Client("clout_colab_telegram", api_id=API_ID, api_hash=API_HASH, bot_token=BOT_TOKEN, workdir="/content")
    await app.start()
    try:
        await app.resolve_peer(TARGET_CHAT_ID)
        print("__WARMUP_OK__")
    except Exception as e:
        found = asyncio.Event()
        async def on_msg(client, message):
            if message.chat and message.chat.id == TARGET_CHAT_ID:
                try:
                    await message.delete()
                except Exception:
                    pass
                found.set()

        h = app.add_handler(handlers.MessageHandler(on_msg))
        def ping():
            import urllib.request
            url = f"https://api.telegram.org/bot{{BOT_TOKEN}}/sendMessage"
            payload = json.dumps({{"chat_id": TARGET_CHAT_ID, "text": "⚡ Clout Session Ping"}}).encode("utf-8")
            req = urllib.request.Request(url, data=payload, headers={{"Content-Type": "application/json"}})
            try:
                urllib.request.urlopen(req, timeout=10)
            except Exception:
                pass

        asyncio.get_running_loop().run_in_executor(None, ping)
        try:
            await asyncio.wait_for(found.wait(), timeout=12.0)
        except Exception:
            pass
        finally:
            try:
                app.remove_handler(*h)
            except Exception:
                pass
        await app.resolve_peer(TARGET_CHAT_ID)
        print("__WARMUP_OK__")
    finally:
        try:
            await app.stop()
        except Exception:
            pass

if __name__ == "__main__":
    try:
        asyncio.get_event_loop().run_until_complete(main())
    except Exception as e:
        print(f"__WARMUP_FAIL__:{{e}}")
"""
        script_file = "/tmp/clout_warmup.py"
        with open(script_file, "w", encoding="utf-8") as f:
            f.write(warmup_script)

        cmd = ["colab", "exec", "-s", session_state.name, "-f", script_file, "--timeout", "300"]
        proc = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        stdout, stderr = await proc.communicate()
        out_str = stdout.decode("utf-8", errors="ignore")

        if os.path.exists(script_file):
            try:
                os.remove(script_file)
            except Exception:
                pass

        if "__WARMUP_OK__" in out_str or proc.returncode == 0:
            return {"status": "connected", "message": "Colab Telegram handshake active and cached"}
        return {"status": "failed", "error": sanitize_error(stderr.decode("utf-8", errors="ignore") or out_str)}

