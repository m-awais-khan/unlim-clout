# -*- mode: python ; coding: utf-8 -*-

import os
import sys
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

block_cipher = None

# Base directory for backend
BASE_DIR = os.path.abspath(SPECPATH)

hidden_imports = [
    # Uvicorn internals
    "uvicorn.logging",
    "uvicorn.loops",
    "uvicorn.loops.auto",
    "uvicorn.protocols",
    "uvicorn.protocols.http",
    "uvicorn.protocols.http.auto",
    "uvicorn.protocols.http.h11_impl",
    "uvicorn.protocols.websockets",
    "uvicorn.protocols.websockets.auto",
    "uvicorn.protocols.websockets.wsproto_impl",
    "uvicorn.lifespan",
    "uvicorn.lifespan.on",
    "uvicorn.lifespan.off",
    # Pyrogram & crypto
    "pyrogram",
    "pyrogram.crypto",
    "tgcrypto",
    # SQLAlchemy & SQLite
    "sqlalchemy.dialects.sqlite",
    "sqlite3",
    # Multipart & FastApi
    "multipart",
    "python_multipart",
    "pydantic",
    "starlette",
    "fastapi",
    "aiofiles",
    "dotenv",
    "engineio.async_drivers.asgi",
]

hidden_imports += collect_submodules("uvicorn")
hidden_imports += collect_submodules("pyrogram")
hidden_imports += collect_submodules("sqlalchemy")
hidden_imports += collect_submodules("src")

datas = collect_data_files("pyrogram")
env_file = os.path.join(BASE_DIR, ".env")
if os.path.exists(env_file):
    datas.append((env_file, "."))

# Add backend/src as source package
a = Analysis(
    [os.path.join(BASE_DIR, "run_server.py")],
    pathex=[BASE_DIR],
    binaries=[],
    datas=datas,
    hiddenimports=hidden_imports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=["tkinter", "matplotlib", "PIL"],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.zipfiles,
    a.datas,
    [],
    name="backend-x86_64-pc-windows-msvc",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    upx_exclude=[],
    runtime_tmpdir=None,
    console=False,
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
)
