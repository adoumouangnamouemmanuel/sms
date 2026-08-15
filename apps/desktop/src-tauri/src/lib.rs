use serde::{Deserialize, Serialize};
#[cfg(windows)]
use std::os::windows::process::CommandExt;
use std::{
    fs,
    io::{BufRead, BufReader, Read, Write},
    net::{TcpStream, ToSocketAddrs},
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::Duration,
};
use tauri::{Manager, RunEvent};

#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const SIDECAR_EXE: &str = "edutrack-api-sidecar.exe";
#[cfg(all(windows, target_arch = "x86_64"))]
const SIDECAR_TARGET_EXE: &str = "edutrack-api-sidecar-x86_64-pc-windows-msvc.exe";
const SIDECAR_READY_TYPE: &str = "edutrack-sidecar-ready";
const CAPABILITY_HEADER: &str = "x-edutrack-capability";

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DesktopDeploymentStatus {
    runtime: &'static str,
    sidecar_status: String,
    api_url: Option<String>,
    capability_token: Option<String>,
    database_path: Option<String>,
    database_ready: bool,
    error: Option<String>,
}

struct DeploymentState {
    child: Mutex<Option<Child>>,
    status: Mutex<DesktopDeploymentStatus>,
    token: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SidecarReadyPayload {
    #[serde(rename = "type")]
    kind: String,
    host: String,
    port: u16,
    health_path: String,
}

#[tauri::command]
fn deployment_status(state: tauri::State<'_, DeploymentState>) -> DesktopDeploymentStatus {
    state
        .status
        .lock()
        .expect("deployment status lock poisoned")
        .clone()
}

pub fn run() {
    let context = tauri::generate_context!();
    let deployment_state =
        DeploymentState::new().expect("failed to initialize secure deployment state");
    let app = tauri::Builder::default()
        .manage(deployment_state)
        .setup(|app| {
            if let Err(error) = start_sidecar(app.handle()) {
                update_status(
                    app.handle(),
                    DesktopDeploymentStatus {
                        runtime: "tauri",
                        sidecar_status: "failed".to_string(),
                        api_url: None,
                        capability_token: None,
                        database_path: None,
                        database_ready: false,
                        error: Some(error.to_string()),
                    },
                );
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![deployment_status])
        .build(context)
        .expect("failed to build EduTrack Africa desktop app");

    app.run(|app_handle, event| {
        if let RunEvent::ExitRequested { .. } = event {
            stop_sidecar(app_handle);
        }
    });
}

impl DeploymentState {
    fn new() -> Result<Self, String> {
        let token = generate_capability_token()?;

        Ok(Self {
            child: Mutex::new(None),
            status: Mutex::new(DesktopDeploymentStatus {
                runtime: "tauri",
                sidecar_status: "starting".to_string(),
                api_url: None,
                capability_token: None,
                database_path: None,
                database_ready: false,
                error: None,
            }),
            token,
        })
    }
}

fn start_sidecar(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let app_data_dir = app_data_directory().map_err(std::io::Error::other)?;
    let database_path = app_data_dir.join("edutrack.sqlite");
    let database_path_string = database_path.display().to_string();
    let state = app.state::<DeploymentState>();
    let token = state.token.clone();
    let access_token_secret =
        resolve_access_token_secret(&app_data_dir).map_err(std::io::Error::other)?;
    let sidecar_path = resolve_sidecar_executable(app).map_err(std::io::Error::other)?;
    let bcrypt_prebuild_path = resolve_bcrypt_prebuild_path(app, &sidecar_path);

    let mut command = Command::new(&sidecar_path);
    command
        .env("EDUTRACK_API_HOST", "127.0.0.1")
        .env("EDUTRACK_API_PORT", "0")
        .env(
            "EDUTRACK_ALLOWED_ORIGIN",
            "tauri://localhost;http://tauri.localhost;http://127.0.0.1:5173",
        )
        .env("EDUTRACK_SIDECAR_TOKEN", &token)
        .env("AUTH_ACCESS_TOKEN_SECRET", &access_token_secret)
        .env("EDUTRACK_SQLITE_PATH", &database_path_string)
        .env("NODE_ENV", "production")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    if let Some(path) = bcrypt_prebuild_path {
        command.env("BCRYPT_PREBUILD", path);
    }

    hide_sidecar_console(&mut command);

    let mut child = command.spawn().map_err(|error| {
        std::io::Error::new(
            error.kind(),
            format!(
                "Failed to launch sidecar at {}: {error}",
                sidecar_path.display()
            ),
        )
    })?;

    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| std::io::Error::other("Failed to capture sidecar stdout."))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| std::io::Error::other("Failed to capture sidecar stderr."))?;

    *state.child.lock().expect("sidecar child lock poisoned") = Some(child);

    let app_handle = app.clone();
    thread::spawn(move || {
        for line in BufReader::new(stdout).lines().map_while(Result::ok) {
            if let Ok(payload) = serde_json::from_str::<SidecarReadyPayload>(&line) {
                if payload.kind == SIDECAR_READY_TYPE {
                    handle_sidecar_ready(&app_handle, &payload, &token, &database_path_string);
                }
            }
        }
    });

    let app_handle = app.clone();
    thread::spawn(move || {
        for line in BufReader::new(stderr).lines().map_while(Result::ok) {
            let text = line.trim().to_string();

            if !text.is_empty() {
                update_error(&app_handle, text);
            }
        }
    });

    let app_handle = app.clone();
    let database_path_string = database_path.display().to_string();
    thread::spawn(move || monitor_sidecar_exit(app_handle, database_path_string));

    Ok(())
}

fn hide_sidecar_console(command: &mut Command) {
    #[cfg(windows)]
    command.creation_flags(CREATE_NO_WINDOW);
}

fn resolve_sidecar_executable(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let mut directories = Vec::new();

    if let Ok(current_exe) = std::env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            directories.push(exe_dir.to_path_buf());
            directories.push(exe_dir.join("binaries"));
        }
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        directories.push(resource_dir.clone());
        directories.push(resource_dir.join("binaries"));
    }

    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    directories.push(manifest_dir.join("binaries"));

    let searched = directories
        .iter()
        .map(|directory| directory.display().to_string())
        .collect::<Vec<_>>()
        .join(", ");

    directories
        .iter()
        .find_map(|directory| find_sidecar_in_directory(directory))
        .ok_or_else(|| {
            format!("Could not find the packaged sidecar executable. Searched: {searched}")
        })
}

fn find_sidecar_in_directory(directory: &Path) -> Option<PathBuf> {
    for executable_name in sidecar_executable_names() {
        let candidate = directory.join(executable_name);

        if candidate.is_file() {
            return Some(candidate);
        }
    }

    fs::read_dir(directory)
        .ok()?
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| {
                    name.starts_with("edutrack-api-sidecar-") && name.ends_with(".exe")
                })
        })
}

fn resolve_bcrypt_prebuild_path(app: &tauri::AppHandle, sidecar_path: &Path) -> Option<PathBuf> {
    let mut candidates = Vec::new();

    if let Some(sidecar_dir) = sidecar_path.parent() {
        candidates.push(sidecar_dir.join("bcrypt"));
        candidates.push(sidecar_dir.join("binaries").join("bcrypt"));
    }

    if let Ok(resource_dir) = app.path().resource_dir() {
        candidates.push(resource_dir.join("bcrypt"));
        candidates.push(resource_dir.join("binaries").join("bcrypt"));
    }

    candidates.push(
        PathBuf::from(env!("CARGO_MANIFEST_DIR"))
            .join("binaries")
            .join("bcrypt"),
    );

    candidates.into_iter().find(|path| {
        path.join("package.json").is_file() && path.join("prebuilds").join("win32-x64").is_dir()
    })
}

fn sidecar_executable_names() -> Vec<&'static str> {
    let mut names = vec![SIDECAR_EXE];

    #[cfg(all(windows, target_arch = "x86_64"))]
    names.push(SIDECAR_TARGET_EXE);

    names
}

fn handle_sidecar_ready(
    app: &tauri::AppHandle,
    payload: &SidecarReadyPayload,
    token: &str,
    database_path: &str,
) {
    let api_url = format!("http://{}:{}", payload.host, payload.port);

    match perform_health_check(&payload.host, payload.port, &payload.health_path, token) {
        Ok(()) => update_status(
            app,
            DesktopDeploymentStatus {
                runtime: "tauri",
                sidecar_status: "ready".to_string(),
                api_url: Some(api_url),
                // The trusted WebView echoes this token on local sidecar API calls.
                capability_token: Some(token.to_string()),
                database_path: Some(database_path.to_string()),
                database_ready: true,
                error: None,
            },
        ),
        Err(error) => update_status(
            app,
            DesktopDeploymentStatus {
                runtime: "tauri",
                sidecar_status: "failed".to_string(),
                api_url: Some(api_url),
                capability_token: None,
                database_path: Some(database_path.to_string()),
                database_ready: false,
                error: Some(error),
            },
        ),
    }
}

fn perform_health_check(host: &str, port: u16, path: &str, token: &str) -> Result<(), String> {
    let address = format!("{host}:{port}");
    let socket = address
        .to_socket_addrs()
        .map_err(|error| error.to_string())?
        .next()
        .ok_or_else(|| format!("No socket address resolved for {address}"))?;
    let mut stream = TcpStream::connect_timeout(&socket, Duration::from_secs(5))
        .map_err(|error| error.to_string())?;

    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .map_err(|error| error.to_string())?;

    let request = format!(
        "GET {path} HTTP/1.1\r\nHost: {host}:{port}\r\n{CAPABILITY_HEADER}: {token}\r\nConnection: close\r\n\r\n"
    );

    stream
        .write_all(request.as_bytes())
        .map_err(|error| error.to_string())?;

    let mut response = String::new();
    stream
        .read_to_string(&mut response)
        .map_err(|error| error.to_string())?;

    if response.starts_with("HTTP/1.1 200") || response.starts_with("HTTP/1.0 200") {
        Ok(())
    } else {
        Err("Sidecar health check did not return HTTP 200.".to_string())
    }
}

fn app_data_directory() -> Result<PathBuf, String> {
    std::env::var_os("APPDATA")
        .or_else(|| std::env::var_os("LOCALAPPDATA"))
        .map(PathBuf::from)
        .map(|base| base.join("EduTrack"))
        .ok_or_else(|| {
            "APPDATA or LOCALAPPDATA is required for the local database path.".to_string()
        })
}

const ACCESS_TOKEN_SECRET_FILE: &str = "access-token-secret";
const ACCESS_TOKEN_SECRET_BYTES: usize = 32;

/// Returns the installation-scoped JWT signing secret, generating and persisting it on first
/// launch so signed access tokens survive application restarts. The secret never leaves the
/// device and lives next to the local SQLite database.
fn resolve_access_token_secret(app_data_dir: &Path) -> Result<String, String> {
    let secret_path = app_data_dir.join(ACCESS_TOKEN_SECRET_FILE);

    if let Ok(existing) = fs::read_to_string(&secret_path) {
        let existing = existing.trim().to_string();

        if !existing.is_empty() {
            return Ok(existing);
        }
    }

    let secret = generate_hex_secret()?;
    fs::create_dir_all(app_data_dir)
        .map_err(|error| format!("Failed to create the EduTrack data directory: {error}"))?;
    fs::write(&secret_path, &secret)
        .map_err(|error| format!("Failed to persist the access token secret: {error}"))?;

    Ok(secret)
}

fn stop_sidecar(app: &tauri::AppHandle) {
    let state = app.state::<DeploymentState>();
    let mut child = state
        .child
        .lock()
        .expect("sidecar child lock poisoned")
        .take();

    if let Some(child) = child.as_mut() {
        let _ = child.kill();
    }
}

fn monitor_sidecar_exit(app: tauri::AppHandle, database_path: String) {
    loop {
        thread::sleep(Duration::from_secs(1));

        let exit_status = {
            let state = app.state::<DeploymentState>();
            let mut child = state.child.lock().expect("sidecar child lock poisoned");

            match child
                .as_mut()
                .and_then(|child| child.try_wait().ok())
                .flatten()
            {
                Some(status) => {
                    child.take();
                    Some(status)
                }
                None => None,
            }
        };

        if let Some(status) = exit_status {
            update_status(
                &app,
                DesktopDeploymentStatus {
                    runtime: "tauri",
                    sidecar_status: "stopped".to_string(),
                    api_url: None,
                    capability_token: None,
                    database_path: Some(database_path),
                    database_ready: false,
                    error: Some(format!("Sidecar exited with status {status}")),
                },
            );
            return;
        }
    }
}

fn update_error(app: &tauri::AppHandle, error: String) {
    let state = app.state::<DeploymentState>();
    let mut status = state
        .status
        .lock()
        .expect("deployment status lock poisoned");

    if status.error.is_none() {
        status.error = Some(error);
    }
}

fn update_status(app: &tauri::AppHandle, next_status: DesktopDeploymentStatus) {
    let state = app.state::<DeploymentState>();
    *state
        .status
        .lock()
        .expect("deployment status lock poisoned") = next_status;
}

fn generate_capability_token() -> Result<String, String> {
    generate_hex_secret()
}

fn generate_hex_secret() -> Result<String, String> {
    let mut bytes = [0_u8; ACCESS_TOKEN_SECRET_BYTES];

    getrandom::getrandom(&mut bytes)
        .map_err(|error| format!("Failed to generate a secure random secret: {error}"))?;

    Ok(bytes.iter().map(|byte| format!("{byte:02x}")).collect())
}
