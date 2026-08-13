# Phase 1 Gate Evidence

This document records the evidence used to close roadmap section 7.4.

## Clean Source Verification

Date: 2026-08-13

Verification was run from a temporary clean source tree created from the repository contents, without relying on existing `dist` outputs or local `node_modules`.

Commands:

```bash
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run test
pnpm run build
```

Result: passed.

Notes:

- A clean-clone test initially exposed that `apps/api` tests resolved workspace packages through package `dist` exports before those packages had been built.
- `apps/api/vitest.config.ts` now aliases `@edutrack/db` and `@edutrack/shared` to source files for tests, matching the source-alias pattern already used by the web app.

## Desktop And Sidecar Verification

Date: 2026-08-13

Commands:

```bash
pnpm run verify:sidecar
pnpm run check:desktop
```

Result: passed.

Evidence:

- `verify:sidecar` started the packaged sidecar executable, called `/health` over `127.0.0.1`, and confirmed a SQLite probe database was created.
- `check:desktop` rebuilt the self-contained Windows sidecar and ran `cargo check` against the Tauri desktop shell.
- `apps/desktop/src-tauri/tauri.conf.json` bundles the sidecar through `bundle.externalBin`.
- `docs/decisions/ADR-007-tauri-sidecar-packaging-and-loopback.md` records the accepted packaging strategy and WebView2 offline installer mode.

## Migration And Recovery Verification

Date: 2026-08-13

Commands:

```bash
pnpm --filter @edutrack/db run test
pnpm run db:migrate
pnpm run db:seed
```

Result: passed.

Evidence:

- The database foundation test applies the committed `0000` and `0001` SQLite migration files to a non-empty scaffold database.
- The same test proves transaction rollback by inserting a school inside a transaction, throwing an error, and verifying the inserted row is absent.
- The temporary migrate-and-seed smoke test created and seeded a fresh SQLite database under `.data`.

## Runtime Independence

The installed Version 1 skeleton does not require a globally installed Node.js runtime on school machines.

Evidence:

- The Fastify API is packaged into a Windows executable with `@yao-pkg/pkg`.
- Tauri bundles that executable as an external sidecar.
- The desktop shell launches the bundled sidecar from Rust rather than invoking `node`.
- Tauri is configured with WebView2 `offlineInstaller` mode for the Windows installer.

Developer commands still require Node.js, pnpm, Rust and build tooling. That requirement applies only to development and packaging, not to running the installed school application.
