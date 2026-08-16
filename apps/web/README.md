# EduTrack Africa Web

This package is the Vite React product UI shared by browser development and the Tauri WebView.

## Getting Started

From the repository root:

```bash
pnpm dev
```

Open <http://127.0.0.1:5173>.

## Checks

```bash
pnpm --filter @edutrack/web run typecheck
pnpm --filter @edutrack/web run test
pnpm --filter @edutrack/web run build
```

All user-visible text must use i18n keys. French is the default locale.

## Structure

- `src/modules/` - feature modules (auth, setup, app shell, ...)
- `src/test/` - component and unit tests, plus the shared test setup (`setup.ts`)
