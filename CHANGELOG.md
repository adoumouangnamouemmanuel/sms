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
- **Excel import (Phase 3.4)**: Added the full upload → parse → preview → confirm → transact → report flow for students and teachers — French .xlsx templates with a README sheet, in-memory preview that never persists, row-level French validation (required fields, sex/date/email formats, duplicate codes), rejected-rows CSV with formula-injection protection, and idempotent confirmed imports keyed by a per-school import identifier (`import_batch`, migration 0006). Sample files and a manual walkthrough live in `docs/import-templates/` and `docs/import-guidelines.md`.
- **Shared people UI (Phase 3.3)**: Extracted the list toolbar, pagination, badges, modal shell and archive dialog into `modules/people/ui.tsx` used by both the students and teachers modules.
- **UI conventions**: Documented the label and input conventions (bold normal-case for editable field labels, uppercase small-caps for display labels) in ADR-008, and the teacher-login credential policy in ADR-009.
- **Dashboard (Phase 3)**: Added the Tableau de bord landing screen with real headcount KPIs (students, teachers, guardians, archived records) and clearly marked simulated widgets (per-level distribution, recent activity) until the Classes/audit modules ship.
- **Configuration screen (Phase 3)**: Added the Configuration screen with an editable school profile (persisted via the setup API, header-synced), calendar, system, enabled-modules and session cards.
- **Structure académique screen (Phase 3)**: Added an editable niveaux editor (add/rename/delete/exam-year, persisted via the setup API) with a simulated classes-per-level preview.
- **Teacher password reset (Phase 3.3)**: Added a Réinitialiser le mot de passe action on active teacher login accounts backed by the existing reset endpoint (sessions revoked).
- **Import UX (Phase 3.4)**: Added a drag-and-drop file zone (French, replacing the native browser button), a resizable preview dialog, an import identifier prefilled from the file name + date, and advisory "Possible doublon" warnings that never block.
- **Guardian import (Phase 3.4)**: Added the `GUARDIANS` import kind (own template, no code column), guardian preview/confirm, and sample files in `docs/import-templates/`.
- **Guardian import linking (Phase 3.4)**: Added an optional `Code élève` column to the guardian template — when filled, the imported guardian is automatically linked to the matching student at confirm (relationship `AUTRE`); an unknown student code rejects the row at preview with a clear French message.
- **Phase 3.9.5 gate**: Added `apps/api/src/test/imports.gate.test.ts` — a 1,000-row import load test covering duplicate-free integrity, reimport idempotency, and duplicate names distinguishable by code (ADR-011).
- **Phase 4.1 data model (classes and curriculum)**: Added the `subject`, `classroom`, `class_subject`, `class_enrollment` and `student_subject_enrollment` tables (migrations 0013–0015, renumbered from 0008–0010) with composite tenant foreign keys, partial unique indexes (year-local classroom codes, one ACTIVE class enrollment per student/year, optional-subject links), and domain CHECK constraints (subject category, coefficient ≥ 1, enrollment status, capacity). Five tenant-scoped repositories with two-school isolation, constraint and soft-delete re-link coverage, plus a migration test on a non-empty Phase 3 database. Shared constants `SUBJECT_CATEGORIES`, `ENROLLMENT_STATUSES` and `MAX_GRADE_HUNDREDTHS` (20.00 policy) live in `@edutrack/shared` for later slices.
- **Classes module (Phase 4.2)**: Added the `CLASSES` school module (migration `0012`) and the curriculum slice — a subject catalogue (create/edit/archive/reactivate, 7 categories, optional EN/AR names), classroom management (create/edit/archive per academic year and level, capacity, live headcount), subject/coefficient/teacher assignment per class with required/optional policy, curriculum copy from one class to another with a review step, and a class-register CSV export with formula-injection protection. All class lists are searchable, filterable by level and status, and paginated.
- **Enrolment slice (Phase 4.3)**: Added bulk enrolment (students without an active class enrol into any class, with per-row skipped results), at-most-one active class per student/year enforced end-to-end, transfers with effective date and reason (history preserved), explicit optional-subject enrolment per student, and a roster view per class with capacity fill indicator.
- **Classes imports (Phase 4.2)**: Added `SUBJECTS`, `CLASSROOMS` and `CLASS_SUBJECTS` import kinds (migration `0011`) with French .xlsx templates, row-level validation (known year/level/subject/teacher codes, active year), advisory duplicate warnings, and sample files in `docs/import-templates/`.
- **Navigation (Phase 4.2)**: The Structure académique nav entry now opens the real Classes & programmes module (levels, subjects, classes, enrolment tabs); the simulated structure screen and its mock data were removed.

### Changed

- **Import deduplication (Phase 3.4)**: Names are never treated as identity — rows matching an existing name or code are flagged as possible duplicates in the preview but always import; codes remain the only hard identity.
- **Settings labels**: The school motto field is now labelled "Devise scolaire" to avoid colliding with the currency label "Devise", and genuinely empty optional fields render a muted "Non renseigné".

### Fixed

- **Teacher optimistic concurrency (Phase 3.3)**: Teacher updates now accept an optional `recordVersion` — a stale update is rejected with a `409 TEACHER_VERSION_CONFLICT` (French message in the UI) instead of silently overwriting a newer record.
- **Seed hardening (Phase 3)**: `EDUTRACK_SEED_PASSWORD_HASH` is validated when set (must be a bcrypt hash with cost ≥ 12); seeding fails loudly on a malformed value instead of persisting a broken login.
- **Import robustness (Phase 3.4)**: The workbook header-row scan tolerates sparse rows produced by blank Excel lines (previously a 500 instead of a French validation message), and the import-identifier suggestion test is now time-deterministic.
- **Setup wizard (Phase 3)**: Added regression coverage proving an empty academic-year or term date disables the save action and prevents submission.

- **Web app**: Replaced the generated Next.js scaffold with the Version 1 Vite React shell and French-first i18n.
- **API app**: Replaced the generated hello-world route with a local sidecar foundation, loopback defaults, and redacted logging.
- **Database package**: Limited the active Version 1 database surface to SQLite.

### Removed

- **Out-of-scope scaffolds**: Removed the Expo/mobile app and PostgreSQL/docker setup from the active Version 1 workspace.
