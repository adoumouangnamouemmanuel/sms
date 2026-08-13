# Phase 1 Deployment Spike

This runbook verifies roadmap section 7.2 for the local Windows desktop skeleton.

## Build

```bash
pnpm --filter @edutrack/api run build:sidecar
pnpm run verify:sidecar
pnpm --filter @edutrack/desktop run build
```

The sidecar build creates:

```text
apps/desktop/src-tauri/binaries/edutrack-api-sidecar-x86_64-pc-windows-msvc.exe
```

Tauri bundles that executable through `bundle.externalBin`.

The verification command starts the packaged sidecar directly, calls `/health` with the local capability header, confirms the deployment-probe SQLite database is created, then shuts the sidecar down.

## Local AppData Database

When launched by Tauri, the sidecar receives:

```text
EDUTRACK_SQLITE_PATH=%APPDATA%\EduTrack\edutrack.sqlite
```

The API creates the directory, opens SQLite through `better-sqlite3`, enables WAL mode and applies the deployment-probe migration.

## Loopback Protection

The desktop shell starts the API on `127.0.0.1` with port `0`, allowing the OS to choose a free local port. Tauri reads the sidecar ready message, calls `/health`, and includes the `x-edutrack-capability` header.

Requests with an unexpected `Origin` or missing capability token are rejected when the sidecar token is configured.

## WebView2 Strategy

Use Tauri's Windows `offlineInstaller` WebView2 mode for the Version 1 pilot installer. It makes the installer larger, but it avoids requiring internet on target school machines when WebView2 is missing.

## Clean-Machine Verification

Use a Windows 10 or Windows 11 machine with no Node.js, Rust or developer tools installed.

1. Copy only the generated installer to the machine.
2. Disconnect the machine from the internet.
3. Run the installer.
4. Launch EduTrack Africa.
5. Confirm the UI opens.
6. Confirm the sidecar status displays as verified.
7. Confirm `%APPDATA%\EduTrack\edutrack.sqlite` exists.
8. Close and relaunch the app.
9. Confirm the same SQLite file remains in place.

Record the Windows version, installer path, timestamp and result before closing roadmap item 7.2.
