import os
import shutil
import tempfile
import asyncio

try:
    asyncio.get_running_loop()
except RuntimeError:
    asyncio.set_event_loop(asyncio.new_event_loop())

import uuid
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

import pyrogram
from fastapi import FastAPI, UploadFile, Depends, HTTPException, Form, BackgroundTasks, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .database import engine, init_db, get_db
from .models import Folder, File, FilePart
from .telegram_utils import init_client
from . import telegram_utils as tu
from .telegram_utils import upload_file_to_telegram, download_file_from_telegram, delete_messages_from_telegram
from .drive_routes import drive_router, settings_router


# Ensure temporary directory exists
os.makedirs("/tmp", exist_ok=True)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    init_db()
    # Note: Telegram client is intentionally NOT started here. 
    # It will be triggered via API to allow frontend proxy flow.
    yield
    # Shutdown
    try:
        await tu.disconnect_client()
    except Exception:
        pass

app = FastAPI(lifespan=lifespan)

# Setup CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_cache_control_header(request, call_next):
    response = await call_next(request)
    if request.url.path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

@app.get("/api/health")
def health_check():
    return {"status": "ok", "app": "unlim-clout"}

@app.post("/api/system/shutdown")
def api_shutdown():
    def _delayed_exit():
        import time
        time.sleep(0.3)
        os._exit(0)
    import threading
    threading.Thread(target=_delayed_exit, daemon=True).start()
    return {"status": "shutting_down"}


app.include_router(drive_router)
app.include_router(settings_router)

# --- Connection API ---


connection_status = "uninitialized"
connection_error = None
connection_task = None

def format_telegram_error(err: Exception) -> str:
    msg = str(err).lower()
    if "connect call failed" in msg or "timeout" in msg or "network" in msg or "unreachable" in msg:
        return "Network connection timed out. Please check your internet connection or VPN."
    if "peer_id_invalid" in msg or "peer id invalid" in msg:
        return "Bot cannot access the channel. Please ensure the bot is an Administrator in your Telegram channel."
    if "unauthorized" in msg or "token" in msg:
        return "Invalid bot token. Please check your Bot Token in Settings."
    return str(err)

async def _connect_telegram():
    global connection_status, connection_error
    if not tu.BOT_TOKEN or not tu.TARGET_CHAT_ID:
        connection_status = "unconfigured"
        connection_error = "Telegram credentials not configured in Settings."
        return

    try:
        async def do_connect():
            if tu.app is None or not getattr(tu.app, "is_connected", False):
                await tu.init_client()
                await tu.app.start()
                await tu.ensure_connection()
        await asyncio.wait_for(do_connect(), timeout=15.0)
        connection_status = "connected"
        connection_error = None
        print("[SUCCESS] Bot is already connected and knows the Target Chat!")
    except asyncio.TimeoutError:
        await tu.disconnect_client()
        connection_status = "failed"
        connection_error = "Connection timed out. Telegram servers are unreachable. Please check your network connection or VPN."
        print("[ERROR] Telegram connection timed out.")
    except Exception as e:
        await tu.disconnect_client()
        connection_status = "failed"
        connection_error = format_telegram_error(e)
        print(f"[ERROR] Telegram connection failed: {e}")

@app.get("/api/connection/status")
def get_connection_status():
    configured = bool(tu.BOT_TOKEN and tu.TARGET_CHAT_ID)
    curr_status = "unconfigured" if not configured else connection_status
    return {"status": curr_status, "error": connection_error, "configured": configured}

@app.post("/api/connection/start")
async def start_connection():
    global connection_status, connection_task, connection_error
    if not tu.BOT_TOKEN or not tu.TARGET_CHAT_ID:
        connection_status = "unconfigured"
        connection_error = "Telegram credentials not configured. Please open Settings."
        return {"status": "unconfigured", "error": connection_error, "configured": False}
    if connection_status == "connected":
        return {"status": "connected", "configured": True}
    if connection_status == "connecting":
        return {"status": "connecting", "configured": True}

    connection_status = "connecting"
    connection_error = None
    connection_task = asyncio.create_task(_connect_telegram())
    return {"status": "connecting", "configured": True}

@app.post("/api/connection/disconnect")
async def disconnect_connection():
    global connection_status, connection_error
    try:
        await tu.disconnect_client()
    except Exception:
        pass
    connection_status = "uninitialized"
    connection_error = None
    return {"status": "uninitialized"}

# --- Pydantic Schemas ---
class FolderCreate(BaseModel):
    name: str
    parent_id: Optional[int] = None

class FolderResponse(BaseModel):
    id: int
    name: str
    parent_id: Optional[int] = None
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class FileResponseModel(BaseModel):
    id: int
    filename: str
    folder_id: Optional[int] = None
    file_size: int
    created_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class DirectoryContents(BaseModel):
    folders: List[FolderResponse]
    files: List[FileResponseModel]

class RenameFileRequest(BaseModel):
    new_name: str

class MoveItemRequest(BaseModel):
    new_folder_id: Optional[int] = None

# --- Routes ---

@app.post("/api/folders", response_model=FolderResponse)
def create_folder(folder: FolderCreate, db: Session = Depends(get_db)):
    existing = db.query(Folder).filter(Folder.name == folder.name, Folder.parent_id == folder.parent_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="A folder with this name already exists here.")
    db_folder = Folder(name=folder.name, parent_id=folder.parent_id)
    db.add(db_folder)
    db.commit()
    db.refresh(db_folder)
    return db_folder

@app.get("/api/storage")
def get_storage_summary(db: Session = Depends(get_db)):
    from sqlalchemy import func
    total_bytes = db.query(func.sum(File.file_size)).scalar() or 0
    file_count = db.query(func.count(File.id)).scalar() or 0
    return {"used_bytes": total_bytes, "file_count": file_count}

@app.get("/api/all-folders", response_model=List[FolderResponse])
def get_all_folders(db: Session = Depends(get_db)):
    return db.query(Folder).all()

@app.get("/api/folders/{folder_id}", response_model=DirectoryContents)
@app.get("/api/folders", response_model=DirectoryContents)
def get_folder_contents(folder_id: Optional[int] = None, db: Session = Depends(get_db)):
    folders = db.query(Folder).filter(Folder.parent_id == folder_id).all()
    files = db.query(File).filter(File.folder_id == folder_id).all()
    return {"folders": folders, "files": files}


@app.post("/api/upload")
async def upload_file(
    request: Request,
    file: UploadFile,
    folder_id: Optional[int] = Form(None),
    upload_id: Optional[str] = Form(None),
    relative_path: Optional[str] = Form(None),
    db: Session = Depends(get_db)
):
    upload_session_id = upload_id or uuid.uuid4().hex[:12]
    current_task = asyncio.current_task()
    if upload_id:
        if upload_id not in tu.active_uploads:
            tu.active_uploads[upload_id] = {}
        tu.active_upload_tasks[upload_id] = current_task
        if tu.active_uploads[upload_id].get("cancelled"):
            return JSONResponse(status_code=499, content={"detail": "Upload cancelled by client"})

    async def watch_disconnect():
        try:
            while True:
                if await request.is_disconnected():
                    logger.info(f"Client disconnected for upload {upload_id}")
                    if upload_id and upload_id in tu.active_uploads:
                        tu.active_uploads[upload_id]["cancelled"] = True
                    task = tu.active_upload_tasks.get(upload_id) if upload_id else current_task
                    if task and not task.done():
                        task.cancel()
                    break
                await asyncio.sleep(0.5)
        except asyncio.CancelledError:
            pass

    disconnect_watcher = asyncio.create_task(watch_disconnect())

    # Handle nested folders if relative_path or file.filename contains directories
    raw_path = (relative_path or file.filename or "file").replace('\\', '/')
    clean_filename = os.path.basename(raw_path)
    
    if '/' in raw_path:
        parts = raw_path.split('/')[:-1] # Exclude the filename itself
        current_parent_id = folder_id
        for part in parts:
            part = part.strip()
            if not part: 
                continue
            if current_parent_id is None:
                existing_folder = db.query(Folder).filter(Folder.name == part, Folder.parent_id.is_(None)).first()
            else:
                existing_folder = db.query(Folder).filter(Folder.name == part, Folder.parent_id == current_parent_id).first()
            
            if existing_folder:
                current_parent_id = existing_folder.id
            else:
                new_folder = Folder(name=part, parent_id=current_parent_id)
                db.add(new_folder)
                db.commit()
                db.refresh(new_folder)
                current_parent_id = new_folder.id
        folder_id = current_parent_id

    # Check uniqueness before uploading to save bandwidth
    if folder_id is None:
        existing = db.query(File).filter(File.filename == clean_filename, File.folder_id.is_(None)).first()
    else:
        existing = db.query(File).filter(File.filename == clean_filename, File.folder_id == folder_id).first()
    if existing:
        if disconnect_watcher and not disconnect_watcher.done():
            disconnect_watcher.cancel()
        raise HTTPException(status_code=400, detail="A file with this name already exists in this folder.")
        
    tmp_upload_dir = os.path.join(tempfile.gettempdir(), "unlim_clout_tmp", upload_session_id)
    os.makedirs(tmp_upload_dir, exist_ok=True)
    tmp_path = os.path.join(tmp_upload_dir, clean_filename)
    
    try:
        # Save file to local tmp in chunks, checking cancellation
        with open(tmp_path, "wb") as buffer:
            while True:
                if upload_id and tu.active_uploads.get(upload_id, {}).get("cancelled"):
                    raise pyrogram.StopTransmission("Upload cancelled by client")
                chunk = await file.read(1024 * 1024)
                if not chunk:
                    break
                buffer.write(chunk)
            
        file_size = os.path.getsize(tmp_path)
        
        if upload_id and tu.active_uploads.get(upload_id, {}).get("cancelled"):
            raise pyrogram.StopTransmission("Upload cancelled by client")

        # Upload to Telegram with clean original filename (chunked if necessary)
        message_ids = await upload_file_to_telegram(tmp_path, upload_id, file_name=clean_filename)
        
        if upload_id and tu.active_uploads.get(upload_id, {}).get("cancelled"):
            if 'message_ids' in locals() and message_ids:
                try:
                    await delete_messages_from_telegram(message_ids)
                except Exception:
                    pass
            raise pyrogram.StopTransmission("Upload cancelled by client")

        # Save to DB
        db_file = File(
            filename=clean_filename,
            folder_id=folder_id,
            file_size=file_size
        )
        db.add(db_file)
        db.commit()
        db.refresh(db_file)
        
        # Save parts to DB
        for i, msg_id in enumerate(message_ids):
            part = FilePart(
                file_id=db_file.id,
                telegram_message_id=msg_id,
                part_number=i+1
            )
            db.add(part)
        db.commit()
        
        return {"id": db_file.id, "filename": db_file.filename}
    except (pyrogram.StopTransmission, asyncio.CancelledError):
        db.rollback()
        logger.info(f"Upload {upload_id} was cancelled.")
        if 'message_ids' in locals() and message_ids:
            try:
                await delete_messages_from_telegram(message_ids)
            except Exception:
                pass
        return JSONResponse(status_code=499, content={"detail": "Upload cancelled by client"})
    except HTTPException as he:
        db.rollback()
        if 'message_ids' in locals() and message_ids:
            try:
                await delete_messages_from_telegram(message_ids)
            except Exception:
                pass
        raise he
    except Exception as e:
        logger.error(f"Error during upload {upload_id}: {e}", exc_info=True)
        db.rollback()
        # Clean up any messages uploaded to telegram if failed/cancelled
        if 'message_ids' in locals() and message_ids:
            try:
                await delete_messages_from_telegram(message_ids)
            except Exception:
                pass
        raise e
    finally:
        if 'disconnect_watcher' in locals() and disconnect_watcher and not disconnect_watcher.done():
            disconnect_watcher.cancel()
        # Clean up local tmp file and directory
        if 'tmp_path' in locals() and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
        if 'tmp_upload_dir' in locals() and os.path.exists(tmp_upload_dir):
            try:
                shutil.rmtree(tmp_upload_dir, ignore_errors=True)
            except Exception:
                pass
        # Clean up active upload state
        if upload_id:
            tu.active_uploads.pop(upload_id, None)
            tu.active_upload_tasks.pop(upload_id, None)


@app.get("/api/progress/{upload_id}")
def get_upload_progress(upload_id: str):
    if upload_id in tu.active_uploads:
        data = tu.active_uploads[upload_id]
        return {
            "current": data.get("current", 0),
            "total": data.get("total", 0),
            "percent": data.get("percent", 0),
            "cancelled": data.get("cancelled", False)
        }
    return {"percent": 100, "current": 0, "total": 0, "cancelled": False}


@app.post("/api/upload/cancel/{upload_id}")
@app.post("/api/upload/{upload_id}/cancel")
async def cancel_upload(upload_id: str):
    logger.info(f"Received cancel request for upload {upload_id}")
    if upload_id not in tu.active_uploads:
        tu.active_uploads[upload_id] = {}
    tu.active_uploads[upload_id]["cancelled"] = True
    task = tu.active_upload_tasks.get(upload_id)
    if task and not task.done():
        logger.info(f"Cancelling task for upload {upload_id}")
        task.cancel()
    return {"status": "cancelled", "upload_id": upload_id}


def remove_file(path: str):
    if os.path.exists(path):
        os.remove(path)


def cleanup_download(path: str, dl_id: str):
    if os.path.exists(path):
        try:
            os.remove(path)
        except Exception:
            pass
    if dl_id in tu.active_downloads:
        del tu.active_downloads[dl_id]


@app.post("/api/download/start/{file_id}")
async def start_download(file_id: int, download_id: Optional[str] = None, db: Session = Depends(get_db)):
    db_file = db.query(File).filter(File.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    parts = db.query(FilePart).filter(FilePart.file_id == file_id).order_by(FilePart.part_number).all()
    message_ids = [p.telegram_message_id for p in parts]
    if not message_ids:
        raise HTTPException(status_code=500, detail="File parts missing in database")

    dl_id = download_id or f"dl_{uuid.uuid4().hex}"
    tmp_dir = os.path.join(tempfile.gettempdir(), "unlim_clout_downloads")
    os.makedirs(tmp_dir, exist_ok=True)
    safe_name = f"{dl_id}_{db_file.filename}"
    tmp_path = os.path.join(tmp_dir, safe_name)

    tu.active_downloads[dl_id] = {
        "status": "downloading",
        "current": 0,
        "total": db_file.file_size,
        "percent": 0,
        "filename": db_file.filename,
        "tmp_path": tmp_path,
        "cancelled": False,
        "error": None
    }

    # Start download task asynchronously in background
    asyncio.create_task(
        download_file_from_telegram(
            message_ids=message_ids,
            output_path=tmp_path,
            download_id=dl_id,
            total_size=db_file.file_size
        )
    )

    return {
        "download_id": dl_id,
        "filename": db_file.filename,
        "file_size": db_file.file_size,
        "status": "downloading"
    }


@app.get("/api/download/progress/{download_id}")
def get_download_progress(download_id: str):
    if download_id in tu.active_downloads:
        info = tu.active_downloads[download_id]
        return {
            "status": info.get("status", "downloading"),
            "percent": info.get("percent", 0),
            "current": info.get("current", 0),
            "total": info.get("total", 0),
            "filename": info.get("filename", ""),
            "error": info.get("error")
        }
    return {"status": "unknown", "percent": 100, "current": 0, "total": 0}


@app.get("/api/download/file/{download_id}")
async def get_downloaded_file(download_id: str, background_tasks: BackgroundTasks):
    if download_id not in tu.active_downloads:
        raise HTTPException(status_code=404, detail="Download session not found")

    dl_info = tu.active_downloads[download_id]
    if dl_info.get("status") != "ready":
        raise HTTPException(status_code=400, detail="File is not ready yet")

    tmp_path = dl_info.get("tmp_path")
    if not tmp_path or not os.path.exists(tmp_path):
        raise HTTPException(status_code=404, detail="Prepared file not found on server")

    filename = dl_info.get("filename", "downloaded_file")
    background_tasks.add_task(cleanup_download, tmp_path, download_id)

    return FileResponse(
        path=tmp_path,
        filename=filename,
        media_type="application/octet-stream"
    )


@app.post("/api/download/cancel/{download_id}")
def cancel_download(download_id: str):
    if download_id in tu.active_downloads:
        tu.active_downloads[download_id]["cancelled"] = True
        tu.active_downloads[download_id]["status"] = "cancelled"
        tmp_path = tu.active_downloads[download_id].get("tmp_path")
        parts_folder = tu.active_downloads[download_id].get("parts_folder")
        if parts_folder and os.path.exists(parts_folder):
            shutil.rmtree(parts_folder, ignore_errors=True)
        if tmp_path and os.path.exists(tmp_path):
            try:
                os.remove(tmp_path)
            except Exception:
                pass
        return {"status": "cancelled"}
    return {"status": "not_found"}


@app.get("/api/download/{file_id}")
async def download_file(file_id: int, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    db_file = db.query(File).filter(File.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
        
    parts = db.query(FilePart).filter(FilePart.file_id == file_id).order_by(FilePart.part_number).all()
    message_ids = [p.telegram_message_id for p in parts]
    
    if not message_ids:
        raise HTTPException(status_code=500, detail="File parts missing in database")
        
    tmp_dir = os.path.join(tempfile.gettempdir(), "unlim_clout_downloads")
    os.makedirs(tmp_dir, exist_ok=True)
    safe_name = f"legacy_{uuid.uuid4().hex}_{db_file.filename}"
    tmp_path = os.path.join(tmp_dir, safe_name)
    
    try:
        await download_file_from_telegram(message_ids, tmp_path, total_size=db_file.file_size)
        
        # Cleanup file after sending
        background_tasks.add_task(remove_file, tmp_path)
        
        return FileResponse(
            path=tmp_path, 
            filename=db_file.filename,
            media_type="application/octet-stream"
        )
    except Exception as e:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/files/{file_id}")
async def delete_file(file_id: int, db: Session = Depends(get_db)):
    db_file = db.query(File).filter(File.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
        
    parts = db.query(FilePart).filter(FilePart.file_id == file_id).all()
    message_ids = [p.telegram_message_id for p in parts]
    
    # Delete from telegram (best-effort)
    if message_ids:
        try:
            await delete_messages_from_telegram(message_ids)
        except Exception as e:
            logger.warning(f"Error during telegram deletion for file {file_id}: {e}")
        
    # Cascade delete in DB
    db.delete(db_file)
    db.commit()
    return {"status": "success"}


def get_all_subfolders_and_files(folder_id: int, db: Session):
    folder_ids = [folder_id]
    
    queue = [folder_id]
    while queue:
        current_id = queue.pop(0)
        children = db.query(Folder).filter(Folder.parent_id == current_id).all()
        for child in children:
            folder_ids.append(child.id)
            queue.append(child.id)
            
    files = db.query(File).filter(File.folder_id.in_(folder_ids)).all()
    file_ids = [f.id for f in files]
    
    return folder_ids, file_ids

@app.delete("/api/folders/{folder_id}")
async def delete_folder(folder_id: int, db: Session = Depends(get_db)):
    db_folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found")
        
    folder_ids, file_ids = get_all_subfolders_and_files(folder_id, db)
    
    # 1. Delete all associated files from Telegram (best-effort)
    if file_ids:
        parts = db.query(FilePart).filter(FilePart.file_id.in_(file_ids)).all()
        message_ids = [p.telegram_message_id for p in parts]
        if message_ids:
            try:
                await delete_messages_from_telegram(message_ids)
            except Exception as e:
                logger.warning(f"Error during telegram deletion for folder {folder_id}: {e}")
            
        # 2. Delete FileParts explicitly (since query.delete does not trigger ORM cascades in SQLite)
        db.query(FilePart).filter(FilePart.file_id.in_(file_ids)).delete(synchronize_session=False)
        
        # 3. Delete files from DB
        db.query(File).filter(File.id.in_(file_ids)).delete(synchronize_session=False)
        
    # 3. Delete folders from DB (bottom up to avoid foreign key errors)
    for fid in reversed(folder_ids):
        db.query(Folder).filter(Folder.id == fid).delete()
        
    db.commit()
    return {"status": "success"}



class RenameFolderRequest(BaseModel):
    new_name: str

@app.put("/api/folders/{folder_id}/rename")
def rename_folder(folder_id: int, request: RenameFolderRequest, db: Session = Depends(get_db)):
    db_folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found")
        
    if request.new_name != db_folder.name:
        existing = db.query(Folder).filter(Folder.name == request.new_name, Folder.parent_id == db_folder.parent_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="A folder with this name already exists here.")
            
    db_folder.name = request.new_name
    db.commit()
    db.refresh(db_folder)
    return db_folder


@app.put("/api/files/{file_id}/rename")
def rename_file(file_id: int, request: RenameFileRequest, db: Session = Depends(get_db)):
    db_file = db.query(File).filter(File.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
        
    if request.new_name != db_file.filename:
        existing = db.query(File).filter(File.filename == request.new_name, File.folder_id == db_file.folder_id).first()
        if existing:
            raise HTTPException(status_code=400, detail="A file with this name already exists in this folder.")
            
    db_file.filename = request.new_name
    db.commit()
    db.refresh(db_file)
    return {"id": db_file.id, "filename": db_file.filename}


@app.post("/api/files/{file_id}/copy")
def copy_file(file_id: int, db: Session = Depends(get_db)):
    db_file = db.query(File).filter(File.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
        
    # Generate "Copy of <filename>"
    base_name = f"Copy of {db_file.filename}"
    candidate_name = base_name
    counter = 1
    while db.query(File).filter(File.filename == candidate_name, File.folder_id == db_file.folder_id).first():
        candidate_name = f"Copy ({counter}) of {db_file.filename}"
        counter += 1

    new_file = File(
        filename=candidate_name,
        folder_id=db_file.folder_id,
        file_size=db_file.file_size,
        created_at=datetime.utcnow()
    )
    db.add(new_file)
    db.commit()
    db.refresh(new_file)

    # Copy FileParts if any
    parts = db.query(FilePart).filter(FilePart.file_id == file_id).all()
    for p in parts:
        new_part = FilePart(
            file_id=new_file.id,
            telegram_message_id=p.telegram_message_id,
            part_number=p.part_number
        )
        db.add(new_part)
    db.commit()

    return {"id": new_file.id, "filename": new_file.filename}


@app.put("/api/files/{file_id}/move")
def move_file(file_id: int, request: MoveItemRequest, db: Session = Depends(get_db)):
    db_file = db.query(File).filter(File.id == file_id).first()
    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")
        
    if request.new_folder_id is not None:
        folder = db.query(Folder).filter(Folder.id == request.new_folder_id).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Destination folder not found")
            
    if request.new_folder_id == db_file.folder_id:
        raise HTTPException(status_code=400, detail="The file or folder already exists in this location.")

    existing = db.query(File).filter(File.filename == db_file.filename, File.folder_id == request.new_folder_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="The file or folder already exists in this location.")
            
    db_file.folder_id = request.new_folder_id
    db.commit()
    return {"status": "success"}


@app.put("/api/folders/{folder_id}/move")
def move_folder(folder_id: int, request: MoveItemRequest, db: Session = Depends(get_db)):
    db_folder = db.query(Folder).filter(Folder.id == folder_id).first()
    if not db_folder:
        raise HTTPException(status_code=404, detail="Folder not found")
        
    if request.new_folder_id is not None:
        if request.new_folder_id == folder_id:
            raise HTTPException(status_code=400, detail="Cannot move folder into itself")
            
        folder = db.query(Folder).filter(Folder.id == request.new_folder_id).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Destination folder not found")
            
        # Basic circular check
        curr = folder
        while curr.parent_id is not None:
            if curr.parent_id == folder_id:
                raise HTTPException(status_code=400, detail="Cannot move folder into its own child")
            curr = db.query(Folder).filter(Folder.id == curr.parent_id).first()
            
    if request.new_folder_id == db_folder.parent_id:
        raise HTTPException(status_code=400, detail="The file or folder already exists in this location.")

    existing = db.query(Folder).filter(Folder.name == db_folder.name, Folder.parent_id == request.new_folder_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="The file or folder already exists in this location.")
            
    db_folder.parent_id = request.new_folder_id
    db.commit()
    return {"status": "success"}
