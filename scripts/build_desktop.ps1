# ==============================================================================
# Unlim Clout - Local Desktop Application Build Script (Tauri v2 + Python)
# ==============================================================================
param (
    [switch]$SkipBackend = $false,
    [switch]$SkipFrontend = $false,
    [string]$Target = "release"
)

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path "$ScriptDir\.."
Set-Location $ProjectRoot

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "       Building Unlim Clout Desktop Application         " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Dependency Checks
Write-Host "`n[1/4] Checking prerequisites..." -ForegroundColor Yellow

# Auto-detect Cargo in ~/.cargo/bin if not currently in PATH
if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    $cargoBin = "$env:USERPROFILE\.cargo\bin"
    if (Test-Path "$cargoBin\cargo.exe") {
        $env:PATH = "$cargoBin;$env:PATH"
    }
}

$hasNode = Get-Command node -ErrorAction SilentlyContinue
$hasCargo = Get-Command cargo -ErrorAction SilentlyContinue
$hasUv = Get-Command uv -ErrorAction SilentlyContinue
$hasPython = Get-Command python -ErrorAction SilentlyContinue


if (-not $hasNode) {
    Write-Error "Node.js is not found on PATH. Please install Node.js (v20+)."
}

if (-not $hasCargo) {
    Write-Warning "Rust/Cargo is not found on PATH."
    Write-Warning "To build Tauri desktop apps locally, install Rust from: https://rustup.rs"
    Write-Warning "Alternatively, push your code to GitHub to let the GitHub Actions CI/CD build the .exe automatically!"
    exit 1
}

# 2. Build Python Backend Sidecar
if (-not $SkipBackend) {
    Write-Host "`n[2/4] Freezing Python Backend into Tauri sidecar binary..." -ForegroundColor Yellow
    
    # Terminate any running app or backend instances to prevent file locks or port collisions
    Get-Process -Name "backend", "backend-x86_64-pc-windows-msvc", "UnlimClout-portable", "unlim-clout-desktop" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

    # Ensure src-tauri/bin directory exists
    $BinDir = "$ProjectRoot\src-tauri\bin"
    if (-not (Test-Path $BinDir)) {
        New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
    }

    # Switch to backend directory where the virtual environment resides
    $BackendDir = "$ProjectRoot\backend"
    Set-Location $BackendDir

    try {
        if ($hasUv) {
            Write-Host "Using uv in $BackendDir..." -ForegroundColor Gray
            if (-not (Test-Path "$BackendDir\.venv")) {
                Write-Host "Creating virtual environment in backend\.venv..." -ForegroundColor Gray
                uv venv
            }
            Write-Host "Installing/verifying build requirements in backend\.venv..." -ForegroundColor Gray
            uv pip install -r "requirements-build.txt"
            Write-Host "Running PyInstaller via uv..." -ForegroundColor Gray
            uv run pyinstaller "unlim_clout_backend.spec" --distpath "$BinDir" --noconfirm
        } elseif ($hasPython) {
            Write-Host "Using pip to install build requirements..." -ForegroundColor Gray
            pip install -r "requirements-build.txt"
            Write-Host "Running PyInstaller..." -ForegroundColor Gray
            pyinstaller "unlim_clout_backend.spec" --distpath "$BinDir" --noconfirm
        } else {
            Write-Error "Neither uv nor Python was found to build the backend."
        }
    } finally {
        Set-Location $ProjectRoot
    }


    $ExpectedBinary = "$BinDir\backend-x86_64-pc-windows-msvc.exe"
    if (-not (Test-Path $ExpectedBinary)) {
        Write-Error "PyInstaller build failed: Expected binary not found at $ExpectedBinary"
    }
    Write-Host "Backend sidecar generated successfully: $ExpectedBinary" -ForegroundColor Green
} else {
    Write-Host "`n[2/4] Skipping Python backend build (-SkipBackend)." -ForegroundColor DarkGray
}

# 3. Build Frontend
if (-not $SkipFrontend) {
    Write-Host "`n[3/4] Building React 19 / Vite Frontend..." -ForegroundColor Yellow
    Set-Location "$ProjectRoot\frontend"
    npm install
    npm run build
    Set-Location $ProjectRoot
    Write-Host "Frontend build completed successfully." -ForegroundColor Green
} else {
    Write-Host "`n[3/4] Skipping Frontend build (-SkipFrontend)." -ForegroundColor DarkGray
}

# 4. Build Tauri Desktop Application
Write-Host "`n[4/4] Compiling Tauri Desktop Application (Windows Installer & Exe)..." -ForegroundColor Yellow
npx @tauri-apps/cli build

# 5. Collect Deliverables
$DistDesktop = "$ProjectRoot\dist-desktop"
if (-not (Test-Path $DistDesktop)) {
    New-Item -ItemType Directory -Path $DistDesktop -Force | Out-Null
}

$TauriBundle = "$ProjectRoot\src-tauri\target\release\bundle"
if (Test-Path $TauriBundle) {
    Copy-Item -Path "$TauriBundle\*" -Destination $DistDesktop -Recurse -Force
}

$Standalone = "$ProjectRoot\src-tauri\target\release\unlim-clout-desktop.exe"
if (Test-Path $Standalone) {
    Copy-Item -Path $Standalone -Destination "$DistDesktop\UnlimClout-portable.exe" -Force
}

# Copy backend executables so the portable app works without installation
$BackendSrc = "$BinDir\backend-x86_64-pc-windows-msvc.exe"
if (Test-Path $BackendSrc) {
    Copy-Item -Path $BackendSrc -Destination "$DistDesktop\backend-x86_64-pc-windows-msvc.exe" -Force
    Copy-Item -Path $BackendSrc -Destination "$DistDesktop\backend.exe" -Force
}

# Also ensure backend is available in user AppData for global portable launches
$AppDataBin = "$env:APPDATA\UnlimClout\bin"
if (-not (Test-Path $AppDataBin)) {
    New-Item -ItemType Directory -Path $AppDataBin -Force | Out-Null
}
if (Test-Path $BackendSrc) {
    Copy-Item -Path $BackendSrc -Destination "$AppDataBin\backend.exe" -Force
    Copy-Item -Path $BackendSrc -Destination "$AppDataBin\backend-x86_64-pc-windows-msvc.exe" -Force
}

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host " BUILD SUCCESS! Desktop artifacts copied to: $DistDesktop" -ForegroundColor Green
Write-Host "========================================================" -ForegroundColor Green

