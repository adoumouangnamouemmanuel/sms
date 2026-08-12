# ADR-007: Tauri Sidecar Packaging and Loopback Protection

## Status

Accepted

## Context

Phase 1.2 must prove that EduTrack Africa can run as a local Windows desktop skeleton without asking a school to install Node.js, Rust or developer tooling. The desktop shell must load the Vite UI, launch the local Fastify API, create the SQLite database under `AppData/EduTrack`, and reject unrelated local web pages or processes that try to call privileged routes.

The product specification also requires the sidecar packaging mechanism and WebView2 offline strategy to be selected during the deployment spike.

## Decision

Use Tauri 2 with an embedded external sidecar binary:

- the React/Vite UI is built from `apps/web` and loaded by the Tauri WebView;
- the Fastify API is packaged as a Windows executable with `@yao-pkg/pkg`;
- the packaged sidecar is bundled by Tauri through `bundle.externalBin`;
- Tauri launches the resolved sidecar executable from Rust using `std::process::Command`;
- the sidecar binds to `127.0.0.1` on a random available port;
- Tauri passes a per-run capability token through `EDUTRACK_SIDECAR_TOKEN`;
- protected sidecar routes require the `x-edutrack-capability` header when a token is configured;
- the sidecar rejects unexpected `Origin` values;
- Tauri passes `EDUTRACK_SQLITE_PATH` pointing to `%APPDATA%\EduTrack\edutrack.sqlite`;
- the sidecar opens `better-sqlite3`, creates the database directory if needed and applies a minimal deployment-probe migration before serving health checks;
- Tauri performs a loopback `/health` request with the capability token before reporting the sidecar as ready.

For Windows installers, use Tauri's NSIS bundler with:

```json
{
  "webviewInstallMode": {
    "type": "offlineInstaller"
  }
}
```

This embeds the WebView2 offline installer so a supported school machine can install without internet when WebView2 is absent.

## Alternatives Considered

- **Require globally installed Node.js:** rejected because school machines must not need developer tooling.
- **Run the API directly from the React UI:** rejected because authorization, validation, transactions and audit behavior need a local service boundary.
- **Expose the sidecar on the LAN:** rejected for Version 1 because the product is a single-machine offline desktop installation.
- **Use Tauri's default WebView2 bootstrapper download:** rejected for the offline pilot path because it requires internet when WebView2 is missing.
- **Use a fixed WebView2 runtime:** deferred because it increases installer size and operational ownership more than the offline installer option.

## Consequences

The Version 1 desktop skeleton can be distributed as a Tauri installer that includes the UI and packaged API sidecar. The pilot build remains local and SQLite-only.

`@yao-pkg/pkg` is a build-time dependency, not a product runtime dependency. Native addon packaging for `better-sqlite3` must remain part of release verification because it is the highest-risk part of the sidecar packaging path.

The capability token mitigates ordinary browser access to loopback routes, but it is not a complete local privilege boundary. Later authentication work must still enforce user identity, role authorization and audit requirements in application services.

Unsigned local installers may be acceptable for the Phase 1 spike, but release-candidate signing and update policy remain Phase 8 work.
