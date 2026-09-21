#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::sync::{Arc, Mutex};
use tauri::WindowEvent;
use tauri_plugin_shell::process::CommandChild;
use tauri_plugin_shell::ShellExt;

#[allow(dead_code)]
#[derive(Clone)]
struct AppState {
    child: Arc<Mutex<Option<CommandChild>>>,
    child_pid: Arc<Mutex<Option<u32>>>,
}

fn kill_backend_processes(pid_opt: Option<u32>) {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;

        // 1. If we have the specific PID, kill the entire process tree (/T)
        if let Some(pid) = pid_opt {
            let _ = std::process::Command::new("taskkill")
                .args(["/F", "/T", "/PID", &pid.to_string()])
                .creation_flags(CREATE_NO_WINDOW)
                .status();
        }

        // 2. Kill any lingering PyInstaller bootloader or child worker by name
        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/IM", "backend.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();

        let _ = std::process::Command::new("taskkill")
            .args(["/F", "/T", "/IM", "backend-x86_64-pc-windows-msvc.exe"])
            .creation_flags(CREATE_NO_WINDOW)
            .status();
    }
    #[cfg(not(target_os = "windows"))]
    {
        if let Some(pid) = pid_opt {
            let _ = std::process::Command::new("kill")
                .args(["-9", &pid.to_string()])
                .status();
        }
    }
}

#[tauri::command]
fn open_browser_url(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        std::process::Command::new("rundll32")
            .args(["url.dll,FileProtocolHandler", &url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        std::process::Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
}

fn main() {
    let child_handle = Arc::new(Mutex::new(None));
    let child_pid = Arc::new(Mutex::new(None));

    let state = AppState {
        child: Arc::clone(&child_handle),
        child_pid: Arc::clone(&child_pid),
    };

    let cleanup_child = Arc::clone(&child_handle);
    let cleanup_pid = Arc::clone(&child_pid);

    let exit_child = Arc::clone(&child_handle);
    let exit_pid = Arc::clone(&child_pid);

    let app = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_process::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![open_browser_url])
        .setup(move |app| {
            println!("[Tauri] Starting Unlim Clout application...");

            // Terminate any lingering or orphaned backend process holding port 8000
            kill_backend_processes(None);

            let mut spawned = false;

            // 1. Attempt standard Tauri sidecar launch
            if let Ok(cmd) = app.shell().sidecar("backend") {
                match cmd.spawn() {
                    Ok((_rx, child)) => {
                        let pid = child.pid();
                        println!("[Tauri] Backend sidecar launched via Tauri shell with PID: {}", pid);
                        if let Ok(mut lock) = child_handle.lock() {
                            *lock = Some(child);
                        }
                        if let Ok(mut lock) = child_pid.lock() {
                            *lock = Some(pid);
                        }
                        spawned = true;
                    }
                    Err(err) => {
                        eprintln!("[Tauri] Standard sidecar spawn failed: {:?}", err);
                    }
                }
            }

            // 2. Fallback: Search known executable locations (for portable standalone exe)
            if !spawned {
                println!("[Tauri] Searching filesystem fallback paths for backend binary...");
                let mut candidates: Vec<std::path::PathBuf> = Vec::new();

                if let Ok(exe_path) = std::env::current_exe() {
                    if let Some(exe_dir) = exe_path.parent() {
                        candidates.push(exe_dir.join("backend.exe"));
                        candidates.push(exe_dir.join("backend-x86_64-pc-windows-msvc.exe"));
                        candidates.push(exe_dir.join("bin").join("backend.exe"));
                        candidates.push(exe_dir.join("bin").join("backend-x86_64-pc-windows-msvc.exe"));
                    }
                }

                if let Ok(appdata) = std::env::var("APPDATA") {
                    let clout_bin = std::path::PathBuf::from(appdata).join("UnlimClout").join("bin");
                    candidates.push(clout_bin.join("backend.exe"));
                    candidates.push(clout_bin.join("backend-x86_64-pc-windows-msvc.exe"));
                }

                candidates.push(std::path::PathBuf::from(r"C:\Program Files\Unlim Clout\backend.exe"));
                candidates.push(std::path::PathBuf::from(r"dist-desktop\backend.exe"));
                candidates.push(std::path::PathBuf::from(r"src-tauri\bin\backend-x86_64-pc-windows-msvc.exe"));

                for p in candidates {
                    if p.exists() {
                        println!("[Tauri] Found backend binary at {:?}, launching...", p);
                        #[cfg(target_os = "windows")]
                        {
                            use std::os::windows::process::CommandExt;
                            const CREATE_NO_WINDOW: u32 = 0x08000000;
                            match std::process::Command::new(&p)
                                .creation_flags(CREATE_NO_WINDOW)
                                .spawn()
                            {
                                Ok(child) => {
                                    let pid = child.id();
                                    println!("[Tauri] Fallback backend process spawned with PID: {}", pid);
                                    if let Ok(mut lock) = child_pid.lock() {
                                        *lock = Some(pid);
                                    }
                                    spawned = true;
                                    break;
                                }
                                Err(e) => {
                                    eprintln!("[Tauri] Failed to spawn fallback binary at {:?}: {:?}", p, e);
                                }
                            }
                        }
                        #[cfg(not(target_os = "windows"))]
                        {
                            if let Ok(child) = std::process::Command::new(&p).spawn() {
                                let pid = child.id();
                                if let Ok(mut lock) = child_pid.lock() {
                                    *lock = Some(pid);
                                }
                                spawned = true;
                                break;
                            }
                        }
                    }
                }
            }

            if !spawned {
                eprintln!("[Tauri] CRITICAL: Could not find or launch backend server!");
            }

            Ok(())
        })
        .on_window_event(move |_window, event| {
            match event {
                WindowEvent::CloseRequested { .. } | WindowEvent::Destroyed => {
                    let pid = cleanup_pid.lock().ok().and_then(|lock| *lock);
                    if let Ok(mut child_opt) = cleanup_child.lock() {
                        if let Some(child) = child_opt.take() {
                            let _ = child.kill();
                        }
                    }
                    kill_backend_processes(pid);
                    println!("[Tauri] Backend processes killed on window close.");
                }
                _ => {}
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(move |_app_handle, event| {
        match event {
            tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit => {
                let pid = exit_pid.lock().ok().and_then(|lock| *lock);
                if let Ok(mut child_opt) = exit_child.lock() {
                    if let Some(child) = child_opt.take() {
                        let _ = child.kill();
                    }
                }
                kill_backend_processes(pid);
                println!("[Tauri] Backend processes killed on app exit.");
            }
            _ => {}
        }
    });
}
