# ADR-004: Tauri Desktop Shell

## Status

Accepted

## Context

Version 1 must run locally on Windows 10 and 11 computers with modest hardware and unreliable or absent internet. The desktop application must package the React product UI, local sidecar and local SQLite database without requiring schools to install developer tooling.

## Decision

Use Tauri 2 for the Version 1 desktop shell.

The desktop shell is responsible for:

- loading the compiled Vite UI;
- launching and supervising the local Fastify sidecar;
- passing only trusted local connection material to the UI;
- storing application data under a tenant-scoped local data directory;
- supporting an offline installer path validated during the Phase 1 deployment spike.

## Consequences

Tauri keeps memory and disk use lower than an Electron-style runtime, but it requires a deployment spike to prove WebView2, sidecar packaging, clean-machine installation and restart persistence on supported Windows machines.
