# ADR-001: Tech Stack Selection

## Status

Superseded in part by:

- `ADR-003-vite-product-ui.md`
- `ADR-004-tauri-desktop-shell.md`
- `ADR-005-fastify-sidecar.md`
- `ADR-006-sqlite-only-version-1.md`

This ADR remains useful as the original project bootstrap record, but the updated Version 1 baseline in `docs/sms.md` and the newer ADRs govern active implementation.

## Context

EduTrack Africa requires a tech stack that supports offline-first operations for low-spec Windows machines, while also allowing cloud syncing and multi-tenant web access.

## Decision

- **Frontend**: Next.js (React) + TypeScript + Tailwind CSS. Provides robust SSR/SSG and a great developer experience.
- **Mobile**: React Native (Expo). Allows cross-platform mobile app development using React paradigms.
- **Desktop**: Tauri (Rust). Extremely lightweight compared to Electron, suitable for 4GB RAM HDD Windows machines.
- **API**: Node.js + Fastify. Enables full TypeScript monorepo with high performance.
- **Database**: SQLite (local desktop) and PostgreSQL (cloud sync).
- **ORM**: Drizzle ORM for uniform schema definition across SQLite and Postgres.

## Consequences

- Unified TypeScript codebase reduces context switching.
- Shared models and validation schemas between UI, API, and Desktop.
