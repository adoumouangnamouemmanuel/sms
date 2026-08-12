# Contributing to EduTrack Africa

## Runtime

- Use Node.js 24 LTS.
- Use `pnpm` 10 from the repository root.
- Run `pnpm install` after pulling dependency changes.

## Core Commands

- `pnpm format:check`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- `pnpm test:e2e`

## Naming Conventions

- Variables & Functions: `camelCase`
- Classes & Components: `PascalCase`
- Database Columns: `snake_case`

## File Structure

- One component per file.
- One service per file.
- Product UI code belongs in `apps/web` and shared UI primitives belong in `packages/ui`.
- Pure domain rules belong in `packages/domain`.
- Transport types, constants, and validation shared across apps belong in `packages/shared`.
- Database adapters, migrations, repositories, and seeds belong in `packages/db`.

## Commit Messages

Use conventional commits:

- `feat:` New features
- `fix:` Bug fixes
- `chore:` Maintenance
- `docs:` Documentation updates
- `test:` Tests

## Branching

- `main`: Production ready
- `develop`: Integration
- `feature/*`: New features
- `fix/*`: Bug fixes

## Development Rules

- **API Endpoints**: All API endpoints must have input validation. No raw DB queries in route handlers.
- **Financial & Grade Amounts**: All amounts (fees, salaries, grades) must be stored as integers in cents/hundredths to avoid floating point errors. The display layer will handle formatting.
- **Language**: All user-facing strings must go through i18n keys. No hardcoded French strings in components.
- **Version 1 runtime**: Use Vite, Tauri, Fastify, and SQLite. Next.js, mobile apps, cloud sync, PostgreSQL runtime configuration, and Docker database services are out of scope for Version 1 unless a later ADR approves them.
