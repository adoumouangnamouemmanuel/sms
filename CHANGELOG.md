# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **Repository foundation**: Added Node 24 pinning through `.nvmrc`, package engines, `.npmrc`, and CI.
- **Quality checks**: Added strict workspace TypeScript references, root ESLint import-boundary rules, Prettier checks, Vitest unit tests, Testing Library setup, and Playwright smoke tests.
- **CI**: Added GitHub Actions for format, lint, typecheck, unit tests, builds, Playwright smoke tests, and Gitleaks secret scanning.
- **Architecture records**: Accepted ADRs for Vite product UI, Tauri desktop shell, Fastify sidecar, and SQLite-only Version 1.
- **Workspace packages**: Added `@edutrack/domain`, `@edutrack/shared`, and `@edutrack/ui` package boundaries.
- **Setup wizard**: Added the authenticated Phase 2 school setup flow for school profile, academic year, terms, class levels, and implemented-module navigation.
- **Phase 3 data model**: Added `student`, `guardian`, `student_guardian` and `teacher` tables with strict tenant-local code uniqueness, composite tenant foreign keys, soft-archive lifecycle columns, and tenant-scoped repositories for each.
- **Students module (Phase 3.2)**: Added the `STUDENTS` school module and a students/guardians slice — searchable paginated lists, profile views, generated `{school}-{year}-{NNI}` codes with strict uniqueness, multi-guardian links with at-most-one primary, archive/reactivate with audit reasons, and a French-first web UI in the app shell.

### Changed

- **Web app**: Replaced the generated Next.js scaffold with the Version 1 Vite React shell and French-first i18n.
- **API app**: Replaced the generated hello-world route with a local sidecar foundation, loopback defaults, and redacted logging.
- **Database package**: Limited the active Version 1 database surface to SQLite.

### Removed

- **Out-of-scope scaffolds**: Removed the Expo/mobile app and PostgreSQL/docker setup from the active Version 1 workspace.
