import os
import shutil
import asyncio
import logging
import json
import re
import uuid
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from transfer_engine import TransferEngine
from colab_utils import ensure_session_adopted, is_remote_drive_mounted, get_active_session_name

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("worker_server")

app = FastAPI(title="Clout Colab Worker", version="1.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    from patch_colab_cli import patch_colab_cli
    patch_colab_cli()
except Exception as e:
    logger.warning(f"Failed to run patch_colab_cli: {e}")

engine = TransferEngine()
DRIVE_MOUNT_BASE = "/content/drive/MyDrive"

# Holds in-flight interactive subprocesses
auth_process: Optional[asyncio.subprocess.Process] = None
mount_process: Optional[asyncio.subprocess.Process] = None

class UploadJobRequest(BaseModel):
    job_id: str
    drive_file_path: str
    target_chat_id: Any
    api_id: int
    api_hash: str
    bot_token: str

class UploadFolderJobRequest(BaseModel):
    job_id: str
    drive_folder_path: str
    target_chat_id: Any
    api_id: int
    api_hash: str
    bot_token: str

class DownloadJobRequest(BaseModel):
    job_id: str
    message_ids: List[int]
    destination_drive_dir: str
    final_filename: str
    total_size: int
    target_chat_id: Any
    api_id: int
    api_hash: str
    bot_token: str

class VerifyAuthRequest(BaseModel):
    code: str

async def run_colab_cmd(cmd: str, timeout: float = 30.0) -> tuple[int, str, str]:
    """Runs a colab CLI command asynchronously."""
    proc = await asyncio.create_subprocess_shell(
        cmd,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE
    )
    try:
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
        return proc.returncode, stdout.decode("utf-8", errors="ignore"), stderr.decode("utf-8", errors="ignore")
    except asyncio.TimeoutError:
        try:
            proc.kill()
        except Exception:
            pass
        return -1, "", "Command timed out"

def is_colab_authenticated() -> bool:
    """Checks if Google credentials exist in colab-cli config directory."""
    config_dir = os.path.expanduser("~/.config/colab-cli")
    if os.path.exists(config_dir):
        files = os.listdir(config_dir)
        if any("token" in f.lower() or "cred" in f.lower() or "session" in f.lower() for f in files):
            return True
    adc_file = os.path.expanduser("~/.config/gcloud/application_default_credentials.json")
    if os.path.exists(adc_file):
        return True
    return False

@app.get("/health")
def health_check():
    return {"status": "healthy", "service": "clout-colab-worker"}

@app.get("/status")
async def get_status():
    colab_installed = bool(shutil.which("colab"))
    authenticated = is_colab_authenticated()
    session = await asyncio.to_thread(get_active_session_name) if (colab_installed and authenticated) else None
    session_active = bool(session)
    
    # If any transfer job is currently executing, Drive is guaranteed mounted
    is_job_running = any(
        j.get("status") in ("running", "uploading", "downloading", "in_progress")
        for j in engine.active_jobs.values()
    )
    if is_job_running:
        drive_mounted = True
    else:
        drive_mounted = await asyncio.to_thread(is_remote_drive_mounted, session) if session_active else False

    free_mb = 80000.0 if (session_active and drive_mounted) else 0.0

    return {
        "worker_active": True,
        "colab_installed": colab_installed,
        "authenticated": authenticated,
        "session_active": session_active,
        "session_name": session,
        "drive_mounted": drive_mounted,
        "mount_path": DRIVE_MOUNT_BASE if drive_mounted else None,
        "content_free_mb": free_mb
    }


# --- Google OAuth Authentication via colab-cli ---

@app.post("/auth/google/start")
async def start_google_auth():
    """Launches 'colab new' and extracts the Google OAuth authorization URL."""
    global auth_process
    if not shutil.which("colab"):
        raise HTTPException(status_code=500, detail="colab-cli is not installed in the container")

    # Terminate any existing auth process
    if auth_process and auth_process.returncode is None:
        try:
            auth_process.kill()
        except Exception:
            pass

    auth_process = await asyncio.create_subprocess_exec(
        "colab", "new",
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT
    )

    url = None
    buffer = ""
    start_time = asyncio.get_event_loop().time()
    while asyncio.get_event_loop().time() - start_time < 10.0:
        line = await auth_process.stdout.readline()
        if not line:
            break
        text = line.decode("utf-8", errors="ignore")
        buffer += text
        match = re.search(r'(https://accounts\.google\.com/o/oauth2/auth[^\s]+)', text)
        if match:
            url = match.group(1)
            break

    if not url:
        return {"status": "error", "error": "Could not extract auth URL", "output": buffer}

    return {
        "status": "url_ready",
        "auth_url": url,
        "instructions": "Open this URL in your browser, sign in with your Google Account, and paste the code back."
    }

@app.post("/auth/google/verify")
async def verify_google_auth(req: VerifyAuthRequest):
    """Feeds the authorization code into the running 'colab auth login' process."""
    global auth_process
    if not auth_process or auth_process.returncode is not None:
        raise HTTPException(status_code=400, detail="No active authentication process. Click 'Sign in with Google' first.")

    try:
        code_input = req.code.strip() + "\n"
        auth_process.stdin.write(code_input.encode("utf-8"))
        await auth_process.stdin.drain()

        # Wait for completion
        stdout, _ = await asyncio.wait_for(auth_process.communicate(), timeout=15.0)
        output = stdout.decode("utf-8", errors="ignore")

        if auth_process.returncode == 0:
            return {"status": "authenticated", "message": "Successfully logged in to Google Colab!"}
        else:
            return {"status": "failed", "error": output}
    except Exception as e:
        logger.error(f"Error verifying auth code: {e}")
        return {"status": "error", "error": str(e)}

# --- Colab Session & Drive Mount ---

@app.post("/colab/session/start")
async def start_colab_session():
    """Starts a new Google Colab remote runtime session."""
    code, out, err = await run_colab_cmd("colab new", timeout=45.0)
    if code == 0:
        return {"status": "session_started", "output": out}
    return {"status": "failed", "error": err or out}

@app.post("/colab/session/stop")
async def stop_colab_session():
    """Stops/deletes active Colab session to free cloud runtime resources."""
    session = await asyncio.to_thread(get_active_session_name)
    if session:
        code, out, err = await run_colab_cmd(f"colab delete -s {session}", timeout=15.0)
        try:
            from colab_cli.common import state
            state.store.remove(session)
            state._sessions = None
        except Exception:
            pass
        return {"status": "session_stopped", "output": out}
    return {"status": "no_session"}

@app.post("/drive/mount")
async def mount_drive(req: Optional[Dict[str, Any]] = None):
    """Mounts Google Drive on the active Colab runtime via colab-cli."""
    global mount_process
    action = (req or {}).get("action", "mount")

    # Fast check: already mounted
    if await asyncio.to_thread(is_remote_drive_mounted, None, True):
        logger.info("Drive already mounted at /content/drive/MyDrive")
        return {"status": "mounted", "path": DRIVE_MOUNT_BASE}

    # If action is 'confirm', user clicked 'Confirm Access Granted' after visiting Google's drive auth link
    if action == "confirm":
        if await asyncio.to_thread(is_remote_drive_mounted, None, True):
            return {"status": "mounted", "path": DRIVE_MOUNT_BASE}

        if mount_process and mount_process.returncode is None:
            try:
                mount_process.stdin.write(b"\n")
                await mount_process.stdin.drain()
            except Exception as e:
                logger.error(f"Error sending newline to mount process: {e}")

        for _ in range(25):
            await asyncio.sleep(1.0)
            if await asyncio.to_thread(is_remote_drive_mounted, None, True):
                return {"status": "mounted", "path": DRIVE_MOUNT_BASE}

        if await asyncio.to_thread(is_remote_drive_mounted, None, True):
            return {"status": "mounted", "path": DRIVE_MOUNT_BASE}
        return {"status": "failed", "error": "Drive mount confirmation incomplete. Please ensure you clicked 'Allow' in the browser window, then click 'Confirm Access Granted' again."}

    # Check if already mounted before launching subprocess
    if await asyncio.to_thread(is_remote_drive_mounted, None, True):
        return {"status": "mounted", "path": DRIVE_MOUNT_BASE}

    # Ensure active session is genuinely alive on Google Colab!
    session = await asyncio.to_thread(get_active_session_name, True)
    if not session:
        logger.info("No active Colab session. Creating one with 'colab new'...")
        new_code, new_out, new_err = await run_colab_cmd("colab new", timeout=60.0)
        if new_code != 0:
            return {"status": "failed", "error": f"Failed to create Colab session: {new_err or new_out}"}
        session = await asyncio.to_thread(get_active_session_name, True)
        if not session:
            return {"status": "failed", "error": "Failed to adopt newly created Colab session."}

    session_arg = f"-s {session}"

    if mount_process and mount_process.returncode is None:
        try:
            mount_process.kill()
        except Exception:
            pass

    cmd = f"colab drivemount {session_arg}".strip()
    logger.info(f"Launching drive mount process: {cmd}")
    mount_process = await asyncio.create_subprocess_shell(
        cmd,
        stdin=asyncio.subprocess.PIPE,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT
    )

    buffer = ""
    start_time = asyncio.get_event_loop().time()
    # Allow up to 60s for Colab runtime initialization & drivemount output
    while asyncio.get_event_loop().time() - start_time < 60.0:
        if mount_process.returncode is not None:
            break
        try:
            line = await asyncio.wait_for(mount_process.stdout.readline(), timeout=1.0)
        except asyncio.TimeoutError:
            if await asyncio.to_thread(is_remote_drive_mounted, session, True):
                return {"status": "mounted", "path": DRIVE_MOUNT_BASE}
            continue
        if not line:
            break
        text = line.decode("utf-8", errors="ignore")
        buffer += text
        logger.info(f"[colab drivemount] {text.strip()}")

        url_match = re.search(r'(https://accounts\.google\.com/o/oauth2[^\s]+)', text)
        if url_match:
            return {
                "status": "drive_auth_needed",
                "auth_url": url_match.group(1),
                "instructions": "Authorize Google Drive in the opened browser tab, then click 'Confirm Access Granted'."
            }

        if "Mounted at" in text or "already mounted" in text.lower():
            return {"status": "mounted", "path": DRIVE_MOUNT_BASE}

    # Final check: Give Colab a moment and verify if Drive mounted
    for _ in range(5):
        if await asyncio.to_thread(is_remote_drive_mounted, session, True):
            return {"status": "mounted", "path": DRIVE_MOUNT_BASE}
        await asyncio.sleep(1.0)

    # Sanitize error to prevent leaking raw CLI output into UI with correct error precedence
    clean_err = buffer.strip()
    if "404" in clean_err or "lost" in clean_err.lower() or "401" in clean_err:
        try:
            from colab_cli.common import state
            state.store.remove(session)
            state._sessions = None
        except Exception:
            pass
        return {"status": "failed", "error": "Colab runtime session expired. Please click 'Retry Mount' to adopt a fresh session."}

    if "ValueError: mount failed" in clean_err:
        return {"status": "failed", "error": "Google Drive mount failed in Colab. Please click 'Retry Mount' to retry."}

    if not clean_err or "Mounting Google Drive to" in clean_err:
        clean_err = "Drive mount took longer than expected. Please click 'Retry Mount'."

    return {"status": "failed", "error": clean_err}

# --- Drive File Browsing ---

@app.get("/drive/browse")
async def browse_drive(subpath: Optional[str] = ""):
    """Browses files and folders in mounted Google Drive."""
    session_name = await asyncio.to_thread(get_active_session_name)
    if not await asyncio.to_thread(is_remote_drive_mounted, session_name):
        return {
            "current_path": subpath or "/",
            "exists": False,
            "reason": "not_mounted",
            "message": "Google Drive is not mounted. Connect and mount Drive in Settings.",
            "folders": [],
            "files": []
        }

    try:
        from colab_cli.common import state
        from colab_cli.contents import ContentsClient
        s = state.store.get(session_name) if session_name else None
        if not s:
            return {
                "current_path": subpath or "/",
                "exists": False,
                "reason": "no_session",
                "folders": [],
                "files": []
            }

        c = ContentsClient(s)
        clean_sub = (subpath or "").strip("/\\")
        req_path = f"content/drive/MyDrive/{clean_sub}".rstrip("/")
        data = c.list_dir(req_path)
        folders = []
        files = []
        for item in data.get("content", []):
            if item.get("name", "").startswith("."):
                continue
            if item.get("type") == "directory":
                folders.append({
                    "name": item["name"],
                    "path": os.path.join(clean_sub, item["name"]).replace("\\", "/")
                })
            else:
                files.append({
                    "name": item["name"],
                    "path": os.path.join(clean_sub, item["name"]).replace("\\", "/"),
                    "full_path": f"/content/drive/MyDrive/{os.path.join(clean_sub, item['name']).replace('\\', '/')}".replace("//", "/"),
                    "size": item.get("size", 0)
                })
        folders.sort(key=lambda x: x["name"].lower())
        files.sort(key=lambda x: x["name"].lower())
        return {"current_path": subpath or "/", "exists": True, "folders": folders, "files": files}
    except Exception as e:
        logger.error(f"Error browsing remote drive: {e}")
        return {
            "current_path": subpath or "/",
            "exists": False,
            "reason": str(e),
            "message": f"Error browsing Drive: {e}",
            "folders": [],
            "files": []
        }

# --- Background Transfer Job Execution ---

@app.post("/jobs/upload")
async def start_upload_job(req: UploadJobRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        engine.upload_drive_file_to_telegram,
        job_id=req.job_id,
        drive_file_path=req.drive_file_path,
        target_chat_id=req.target_chat_id,
        api_id=req.api_id,
        api_hash=req.api_hash,
        bot_token=req.bot_token
    )
    return {"job_id": req.job_id, "status": "started", "file_name": os.path.basename(req.drive_file_path)}

@app.post("/jobs/upload-folder")
async def start_upload_folder_job(req: UploadFolderJobRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        engine.upload_drive_folder_to_telegram,
        job_id=req.job_id,
        drive_folder_path=req.drive_folder_path,
        target_chat_id=req.target_chat_id,
        api_id=req.api_id,
        api_hash=req.api_hash,
        bot_token=req.bot_token
    )
    return {"job_id": req.job_id, "status": "started", "folder_name": os.path.basename(req.drive_folder_path.rstrip("/"))}

@app.post("/jobs/download")
async def start_download_job(req: DownloadJobRequest, background_tasks: BackgroundTasks):
    background_tasks.add_task(
        engine.download_telegram_to_drive,
        job_id=req.job_id,
        message_ids=req.message_ids,
        destination_drive_dir=req.destination_drive_dir,
        final_filename=req.final_filename,
        total_size=req.total_size,
        target_chat_id=req.target_chat_id,
        api_id=req.api_id,
        api_hash=req.api_hash,
        bot_token=req.bot_token
    )
    return {"job_id": req.job_id, "status": "started", "file_name": req.final_filename}

@app.get("/jobs/{job_id}")
def get_job_status(job_id: str):
    if job_id in engine.active_jobs:
        return engine.active_jobs[job_id]
    return {"status": "not_found", "job_id": job_id}

@app.post("/jobs/{job_id}/cancel")
def cancel_job(job_id: str):
    success = engine.cancel_job(job_id)
    return {"job_id": job_id, "cancelled": success}

class TelegramWarmupRequest(BaseModel):
    target_chat_id: Any
    api_id: int
    api_hash: str
    bot_token: str

@app.post("/telegram/warmup")
async def warmup_telegram(req: TelegramWarmupRequest):
    res = await engine.warmup_telegram_session(
        target_chat_id=req.target_chat_id,
        api_id=req.api_id,
        api_hash=req.api_hash,
        bot_token=req.bot_token
    )
    return res

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
