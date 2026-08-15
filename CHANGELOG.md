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
- **Edit flows (Phase 3.2)**: Added Modifier actions on student and guardian profiles backed by the existing update endpoints.
- **Search UX (Phase 3.2)**: List search boxes now stay bound to the active query with an explicit ✕ clear control instead of clearing on submit.
- **Nationality (Phase 3.2)**: Nationality is a dropdown of African countries with Tchad as the default.
- **Teachers module (Phase 3.3)**: Added the `TEACHERS` school module (migration `0005`) — searchable paginated list, profile views, generated `{school}-{year}-{NNI}` codes, and login accounts created/deactivated independently of the record with credentials shown exactly once.
- **Status filter (Phase 3.3)**: Students, guardians and teachers lists now expose a Filtres panel with an Actif/Archivé status filter, so archived records stay reachable for reactivation.
- **Shared people UI (Phase 3.3)**: Extracted the list toolbar, pagination, badges, modal shell and archive dialog into `modules/people/ui.tsx` used by both the students and teachers modules.
- **UI conventions**: Documented the label and input conventions (bold normal-case for editable field labels, uppercase small-caps for display labels) in ADR-008, and the teacher-login credential policy in ADR-009.

### Changed

- **Web app**: Replaced the generated Next.js scaffold with the Version 1 Vite React shell and French-first i18n.
- **API app**: Replaced the generated hello-world route with a local sidecar foundation, loopback defaults, and redacted logging.
- **Database package**: Limited the active Version 1 database surface to SQLite.

### Removed

- **Out-of-scope scaffolds**: Removed the Expo/mobile app and PostgreSQL/docker setup from the active Version 1 workspace.
