# EduTrack Africa

EduTrack Africa is a French-first, offline-first school administration product for Windows computers in Chad. Version 1 focuses on a narrow trusted workflow: configure a school, manage academic structure, enter official term results, calculate deterministic bulletins, print records, and protect local data without requiring internet.

The current repository is in Phase 1 foundation work. The active Version 1 stack is:

- Node.js 24 LTS
- pnpm 10
- React + Vite for the product UI
- Tauri 2 for the desktop shell
- Fastify for the local sidecar API
- SQLite through Drizzle ORM for Version 1 persistence
- Vitest, Testing Library, Playwright, ESLint, Prettier, and strict TypeScript

## Requirements

- Node.js `>=24.0.0 <25`
- pnpm `>=10.0.0 <11`

Check your versions:

```bash
node --version
pnpm --version
```

If pnpm is not available, enable Corepack or install the pinned version:

```bash
corepack enable
corepack prepare pnpm@10.33.2 --activate
```

## Clone And Setup

```bash
git clone <repository-url>
cd sms
pnpm install --frozen-lockfile
```

Create a local environment file when you need to run the API or database commands:

```bash
cp .env.example .env
```

Then adjust `.env` for your machine. Keep real secrets out of Git.

## Daily Development

Start the web app:

```bash
pnpm run dev
```

Open:

```text
http://127.0.0.1:5173
```

Start only the API sidecar in watch mode:

```bash
pnpm --filter @edutrack/api run dev
```

Start the desktop shell in development mode:

```bash
pnpm --filter @edutrack/desktop run dev
```

## Quality Commands

```bash
pnpm run format:check
```

Checks formatting without modifying files.

```bash
pnpm run format
```

Formats the repository with Prettier.

```bash
pnpm run lint
```

Runs ESLint across the workspace with zero warnings allowed.

```bash
pnpm run typecheck
```

Runs TypeScript project-reference checks across all active packages and apps.

```bash
pnpm run test
```

Runs the unit test suites for the API and web app.

```bash
pnpm run test:e2e
```

Runs the Playwright smoke test. If Chromium is missing, install it once:

```bash
pnpm exec playwright install chromium
```

```bash
pnpm run build
```

Builds all active packages and apps.

```bash
pnpm run check:desktop
```

Builds the Windows sidecar executable and runs the Tauri/Rust compile check.

```bash
pnpm run verify:sidecar
```

Starts the packaged Windows sidecar, calls `/health` with the local capability header, and confirms the SQLite probe database is created.

## Database Commands

Generate SQLite migrations from the Drizzle schema:

```bash
pnpm run db:generate
```

Push the SQLite schema to the configured local database:

```bash
pnpm run db:migrate
```

By default, local SQLite uses:

```text
./.data/edutrack.sqlite
```

Override it with `EDUTRACK_SQLITE_PATH` in `.env`.

## Package-Specific Commands

```bash
pnpm --filter @edutrack/web run dev
pnpm --filter @edutrack/web run build
pnpm --filter @edutrack/web run test
pnpm --filter @edutrack/web run preview
```

Runs web-only development, build, tests, and preview.

```bash
pnpm --filter @edutrack/api run dev
pnpm --filter @edutrack/api run build
pnpm --filter @edutrack/api run build:sidecar
pnpm --filter @edutrack/api run verify:sidecar
pnpm --filter @edutrack/api run start
pnpm --filter @edutrack/api run test
```

Runs API-only development, build, packaged Windows sidecar build, packaged sidecar verification, compiled start, and tests.

```bash
pnpm --filter @edutrack/desktop run dev
pnpm --filter @edutrack/desktop run check
pnpm --filter @edutrack/desktop run build
```

Runs the Tauri desktop shell, sidecar-backed Rust/Tauri compile check, and Windows installer build.

```bash
pnpm --filter @edutrack/domain run build
pnpm --filter @edutrack/shared run build
pnpm --filter @edutrack/ui run build
pnpm --filter @edutrack/db run build
```

Builds individual workspace packages.

## Repository Layout

```text
apps/
  api/       Fastify local sidecar API
  desktop/   Tauri desktop shell
  web/       Vite React product UI
packages/
  db/        Drizzle SQLite schema and database tooling
  domain/    Pure domain rules and calculations
  shared/    Shared constants, transport types, and validation
  ui/        Reusable UI components
docs/
  decisions/ Architecture Decision Records
```

## Version 1 Scope Notes

Version 1 is local and SQLite-only. Next.js, mobile apps, cloud sync, PostgreSQL runtime configuration, finance, attendance, parent/student portals, notifications, and remote web access are intentionally out of scope unless a later ADR approves them.

The Phase 1 deployment spike is documented in `docs/deployment/phase-1-deployment-spike.md`.
