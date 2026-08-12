# AGENTS.md - EduTrack Africa

This file defines the standing instructions for coding agents working on EduTrack Africa. It applies to the whole repository unless a more specific `AGENTS.md` or `AGENTS.override.md` exists in a subdirectory.

## 1. Product mission

EduTrack Africa is an offline-first, multi-tenant school management system designed first for schools in Chad and then for other African markets. Its core value is trustworthy academic administration-especially grade entry, transcript computation, ranking, signing, printing, and long-term student records-on low-spec Windows computers with unreliable connectivity.

Build for real school staff, not for a demo. Correctness, data isolation, recoverability, French-first usability, and offline operation take priority over novelty or visual flourish.

## 2. Canonical project guidance

Before making a meaningful change, read only the documentation relevant to the task:

- `SchoolMS_Roadmap.md` (or `docs/SchoolMS_Roadmap.md`): delivery order, milestones, acceptance criteria, risks, and phase-level definition of done.
- `SchoolMS_UML_Design.md` (or `docs/SchoolMS_UML_Design.md`): domain model, relationships, state machines, role permissions, module boundaries, and architecture.
- `sms.md`: currently a duplicate of the UML design document. Do not treat it as an independent specification or infer extra requirements from it.
- `docs/decisions/`: approved Architecture Decision Records (ADRs). An accepted ADR overrides older option-level recommendations in the roadmap or UML document.
- Existing schemas, migrations, tests, and public API contracts: inspect these before changing implemented behavior. If they conflict with the written design, report the conflict; do not silently choose one.

Use this precedence when instructions conflict:

1. The current user/task request and explicit acceptance criteria.
2. Approved ADRs and security/data-integrity constraints.
3. This `AGENTS.md` and any closer directory-specific instructions.
4. The roadmap for scope and sequencing.
5. The UML design for domain behavior and relationships.
6. Existing implementation details.

Do not edit a canonical rule merely to make an implementation easier. Record intentional architecture or domain changes in an ADR and update affected documentation in the same change.

## 3. Current technical baseline

Unless the repository already contains an approved ADR stating otherwise, use this coherent baseline:

- Monorepo: `pnpm` workspaces.
- Runtime: Node.js 20 LTS.
- Language: strict TypeScript for application and shared package code; Rust only where required by Tauri.
- Frontend: React, Vite, Tailwind CSS, `i18next`/`react-i18next`.
- Desktop: Tauri using the shared React frontend.
- API: Node.js with Fastify.
- Validation: Zod schemas shared where practical between UI and API.
- ORM: Drizzle ORM.
- Local persistence: SQLite for the desktop app.
- Cloud persistence: PostgreSQL; Supabase may host development environments but must not become a hard dependency for authentication or core domain behavior.
- Authentication: self-hosted JWT access tokens, rotating refresh-token flow, and bcrypt password hashing.
- Tests: Vitest and Testing Library for unit/component/integration tests; Playwright for end-to-end tests.
- Documents: `@react-pdf/renderer` for transcript PDFs unless an ADR approves another engine.
- Spreadsheets: SheetJS (`xlsx`) for import/export.
- CI: GitHub Actions.

Do not introduce a competing framework, ORM, package manager, database, auth provider, state library, PDF engine, or sync strategy without an ADR and explicit approval. Ask before adding any production dependency when the same result can reasonably be achieved with the current stack.

## 4. Intended repository layout

```text
apps/
  api/                  Fastify REST API and application services
  desktop/              Tauri shell and desktop integration
  web/                  React web/PWA entry point
packages/
  db/                   Drizzle schemas, migrations, adapters, seeds
  shared/               Domain types, enums, constants, validation, pure logic
  ui/                   Reusable accessible UI components
docs/
  decisions/            ADRs
  database/             Schema documentation
scripts/                Repeatable development, seed, build, and release scripts
```

Keep domain logic out of React components, Fastify route handlers, and database adapters. Prefer the flow:

`route/UI -> validation -> application service -> domain logic -> repository -> database`

Routes parse transport concerns and call services. Services enforce authorization, tenancy, state transitions, transactions, and domain rules. Repositories own persistence queries. Shared pure functions own deterministic calculations.

## 5. Agent working protocol

For every task:

1. Locate the nearest applicable instructions and inspect the relevant package manifests, tests, schemas, migrations, and domain docs.
2. Determine the current roadmap phase and keep the change within that phase unless the task explicitly expands scope.
3. State any material assumption. Ask a focused question only when the answer changes architecture, permissions, persistent data, a public contract, or a destructive operation.
4. Make the smallest complete change. Do not perform unrelated refactors, formatting sweeps, dependency upgrades, or speculative feature work.
5. Add or update tests with the implementation. Reproduce bugs with a failing test when practical.
6. Run the narrowest relevant checks first, then the broader affected suite.
7. Review the diff for tenant leakage, authorization bypasses, unsafe logs, migration issues, rounding errors, untranslated strings, and offline regressions.
8. Summarize what changed, what was verified, and any remaining risk or unverified condition.

Preserve user-authored changes and a dirty working tree. Never discard, overwrite, or revert unrelated work. Do not use destructive Git or filesystem commands unless the user explicitly requests them and the exact target has been verified.

Do not claim a command, test, migration, build, or manual check passed unless it actually ran. If the environment prevents verification, say exactly what remains unverified.

## 6. Commands and tool usage

Inspect the root and package-level `package.json` files before running commands. Prefer repository scripts over ad hoc commands. Expected root scripts include:

```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

These are expected conventions, not permission to invent missing scripts. If a script is absent, use the actual package command or add the script only when it belongs to the task. Use `pnpm --filter <package> ...` for focused checks.

Do not manually edit generated files, lockfiles, migration snapshots, or build output when an official generator exists. Do not start long-lived servers unless required for verification; shut down processes you start.

## 7. Core architecture rules

### 7.1 Offline first

- Every core desktop workflow must remain usable without internet: authentication for an already provisioned local installation, school configuration, student and teacher records, enrollment, grade entry, transcript computation, fee recording, timetable access, PDF generation, and backup/restore.
- The desktop app reads and writes SQLite first. Cloud sync is asynchronous and must never block a local core workflow.
- Queue mutations durably and make retries idempotent. A crash or restart must not lose queued work.
- Show honest sync state in French: last successful sync, offline state, pending changes, and actionable failures.
- Never equate “request accepted” with “safely persisted.”
- Baseline conflict handling is per-record last-write-wins with a durable conflict log, as specified by the current roadmap. Never resolve conflicts silently. Grades, payments, finalized transcripts, and signatures require audit metadata and targeted conflict tests.
- Auto-update only with user confirmation. An update must not invalidate local data or prevent offline startup.

### 7.2 Multi-tenancy

- `school_id` is a security boundary, not merely a filter. Every tenant-owned read, write, update, delete, aggregate, export, job, cache key, file path, and sync operation must be scoped to the authenticated school.
- Derive tenant context from trusted authentication/session state, never from an unverified client-supplied school ID.
- Repository methods for tenant-owned entities should require tenant context by construction.
- Composite uniqueness should include `school_id` where identity is tenant-local.
- Cross-school access is denied by default. Only a deliberately introduced `SuperAdmin` path may cross tenant boundaries, and it must be separately authorized and audited.
- Add automated two-school isolation tests for every new tenant-owned module.

### 7.3 Modular design

Maintain clear module boundaries:

1. Core / school configuration
2. Authentication and users
3. Students
4. Teachers and payroll
5. Classes and curriculum
6. Grades and transcripts
7. Finance
8. Timetable and academic calendar
9. Learning resources
10. Reporting and analytics
11. Import/export and backup
12. Notifications

Modules may be enabled per school through `school_module_config`. Disabled modules must be hidden in the UI and rejected safely at the API/application layer. Avoid circular imports and direct cross-module database access; expose typed service interfaces instead.

### 7.4 Vertical delivery and phase discipline

Build complete, testable slices within the active roadmap phase. Do not scaffold all future modules “for completeness.” Phase 5-the grade and transcript engine-is the central value proposition; earlier data and API decisions must support it without prematurely implementing its UI.

## 8. Data and database rules

- Use UUIDs unless an approved schema already establishes another identifier strategy.
- Database columns use `snake_case`; TypeScript variables and functions use `camelCase`; React components, classes, and exported types use `PascalCase`.
- Store money as integer minor units. XAF normally has no fractional unit in product display, but the storage and formatting policy must remain explicit.
- Store grades, averages, coefficients, and weighted values in exact fixed-point form-prefer integer hundredths at persistence boundaries. Never use unbounded binary floating-point arithmetic for official academic results.
- Round only at explicitly defined domain boundaries. The official transcript average is rounded to two decimal places.
- Enforce integrity in both Zod/application validation and database constraints. The backend remains authoritative.
- Add required `NOT NULL`, `UNIQUE`, foreign-key, check, and index constraints. Choose cascade/restrict behavior deliberately; never blanket-apply cascading deletes to academic or financial history.
- Academic, grade, payment, and signature history should be archived or soft-deactivated rather than destructively deleted.
- Schema changes require a forward migration, a tested rollback or documented irreversible rationale, updated seed data, and compatibility checks for both SQLite and PostgreSQL.
- Migrations must work against realistic existing data, not only an empty database.
- Keep seeds deterministic and idempotent: rerunning a seed must not duplicate existing users or records. Preserve the realistic demo school data defined in the roadmap.
- Do not expose ORM records directly as public API responses. Map them to explicit transport/domain types.
- Use transactions for multi-record invariants such as enrollment, transcript initialization, grade validation, payment/receipt creation, finalization, and sync application.
- Prevent lost updates on mutable critical records using versions, timestamps, or another explicit optimistic-concurrency mechanism.

## 9. Non-negotiable domain invariants

### 9.1 Grades and transcripts

- Accepted grades are from `0.00` through `20.00`, inclusive.
- Accept comma or period as a decimal separator at the input boundary; normalize once and validate before persistence.
- Weighted score: `grade × coefficient`.
- Overall average: `sum(weighted scores) / sum(coefficients)`, rounded to two decimal places.
- An average of exactly `10.00` passes; `9.99` fails.
- Missing grades remain missing. Never silently convert them to zero.
- A zero total coefficient must return a controlled domain result/error, never `NaN`, infinity, or a crash.
- Duplicate student names are valid. Student codes, not names, establish identity.
- Appreciation boundaries are canonical shared constants: 18–20 Excellent; 16–17.99 Très Bien; 14–15.99 Bien; 12–13.99 Assez Bien; 10–11.99 Passable; 8–9.99 Insuffisant; 6–7.99 Faible; 0–5.99 Très Faible.
- Centralize computation in pure shared domain functions. UI previews, API calculations, reports, and PDFs must call the same logic or verify against the same fixtures.
- Teachers may enter and validate grades only for their assigned class-subjects. After validation, grades are read-only unless an authorized SchoolMaster reopens them.
- Respect the lifecycle: `PENDING -> IN_ENTRY -> COMPUTED/RANKED -> FINALIZED -> SIGNED`; error correction uses an authorized, audited `REOPENED` transition.
- Finalized or signed transcripts cannot be mutated in place. Reopening, recomputation, re-finalization, and re-signing must be explicit and audited.
- Ranking must be deterministic. Preserve equal ranks for equal official averages; encode the chosen next-rank policy in tests before changing it.
- PDFs must reproduce persisted official values exactly; never recompute with separate PDF-only logic.

### 9.2 Finance

- Payment recording and receipt-number creation are one atomic operation.
- Receipt numbers are unique and idempotent under retries.
- Never overwrite or silently delete a payment. Corrections use reversal/adjustment records with actor, time, reason, and linkage to the original transaction.
- A student’s balance is derived from fee schedules and validated payments, not trusted client totals.
- Currency defaults to XAF and must always be explicit in storage and output.

### 9.3 Enrollment and academic structure

- Only one academic year and, within it, one term may be current per school unless the domain explicitly supports an overlap.
- Prevent overlapping term dates and invalid year/date ranges.
- Enrollment links a student, classroom, academic year, and active status. Preserve historical enrollments during transfers, promotion, graduation, and dropout.
- State transitions must be validated; do not implement status changes as unrestricted string updates.

## 10. API contracts

- Use versioned REST routes when public compatibility begins; do not change established response shapes casually.
- Validate path parameters, query parameters, headers, and bodies at the API boundary.
- Route handlers must not contain raw database queries or core business logic.
- Use stable machine-readable error codes and localized user-safe messages.
- Never return stack traces, SQL errors, secrets, password hashes, signature keys, or internal file paths.
- Paginate potentially unbounded collections and enforce maximum page/import sizes.
- Bulk operations must report per-item success/failure and use transactions or documented partial-success semantics.
- Make sync, import, and payment endpoints idempotent with explicit idempotency identifiers.

Preserve the established response envelope:

```json
{
  "success": true,
  "data": {},
  "message": "Opération réussie",
  "pagination": { "page": 1, "per_page": 20, "total": 150 }
}
```

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Le prénom est requis",
    "fields": { "first_name": "Ce champ est requis" }
  }
}
```

Do not include `pagination` when it is not applicable.

## 11. Authentication, authorization, and privacy

- Hash passwords with bcrypt at a work factor of at least 12 unless security benchmarks and an ADR approve a stronger alternative.
- Never store plaintext passwords or log credentials/tokens.
- Keep web access tokens in memory and refresh tokens in secure, `httpOnly`, appropriately scoped cookies. Do not put tokens in `localStorage`.
- Rotate and revoke refresh tokens; logout must invalidate the active refresh session.
- Lock an account for 15 minutes after 5 failed login attempts and rate-limit authentication endpoints.
- Authorization is enforced in the service/API layer, not only by hiding controls in the UI.
- Deny by default. A teacher sees only assigned classes/subjects; a student sees only their own records; a SchoolMaster is limited to their school.
- Record an immutable audit event for authentication-sensitive operations, grade validation/reopening, transcript finalization/signing, payment changes, imports, backups/restores, role changes, and cross-tenant administration.
- Never include passwords, tokens, private keys, full sensitive student/parent data, or unnecessary PII in logs, analytics, fixtures, screenshots, or error reports.
- Validate upload MIME type, extension, size, and content signature. Store files outside executable/static code paths with generated names and tenant-scoped access checks.
- Encrypt digital-signature private keys at rest on the device; they never leave the device. Never commit real certificates or keys.
- Treat exports, backups, PDFs, and local database files as sensitive school records.

## 12. Frontend, localization, and accessibility

- French is the default and complete user-facing language from the first implementation. Arabic and English are supported locales.
- Every user-visible string-including validation, empty states, notifications, print/PDF content, accessibility labels, and desktop system messages-must use i18n keys. Do not hardcode French strings in components.
- Support Arabic right-to-left layout. Avoid directional CSS assumptions in shared components.
- Use locale-aware parsing and formatting for dates, decimal commas, names, XAF amounts, and academic-year labels.
- Design grade entry keyboard-first: predictable Tab/Enter movement, visible save state, autosave, recovery, and no loss of partially entered work.
- Use accessible semantic elements, associated labels, focus indicators, keyboard navigation, and sufficient contrast. Do not use color as the only indicator of pass/fail or sync state.
- Optimize for 1366×768 displays, 4 GB RAM, HDD storage, and intermittent/3G connectivity. Avoid large bundles, unnecessary animation, and chatty APIs.
- Responsive web views must work on phones, but desktop school workflows remain the primary usability benchmark.
- Destructive actions require clear French confirmation and explain the consequence. Prefer reversible archive/deactivate flows.

## 13. Import, export, backup, and documents

- Imports follow `upload -> parse -> preview -> validate -> confirm -> transact -> report`; never write records during preview.
- Report row numbers and actionable French validation errors. Do not discard an entire import when safe, explicit partial success is part of the accepted flow.
- Protect against formula injection in spreadsheet exports by escaping untrusted cells beginning with formula control characters.
- Enforce file-size and row-count limits and process large imports/exports without loading unbounded data into memory.
- Backup and restore must be versioned, integrity-checked, tenant-scoped, and tested on non-empty data.
- Transcript PDFs are official records. Values, names, ranking, term, school identity, signature state, and timestamps must match persisted data and remain stable across repeated generation.
- Bulk PDF generation must be bounded and must not exhaust a low-spec machine.

## 14. Testing expectations

Every behavior change needs the lowest-cost test that proves it, plus regression coverage for critical paths.

### Required layers

- Unit: pure calculations, appreciation boundaries, fixed-point conversion, state transitions, permission decisions, validation schemas, code/receipt generation.
- Integration: repositories against SQLite and PostgreSQL where behavior can differ; transactions; tenant scoping; auth refresh/logout; grade workflow; payments; import; sync application.
- Component: French labels, validation, keyboard grade entry, loading/empty/error states, accessibility.
- End-to-end: setup wizard; full class grade entry; transcript initialization through signed PDF; student self-view; Excel import; offline restart and recovery.

### Mandatory edge cases

- Grades `0`, `5.99`, `6`, `7.99`, `8`, `9.99`, `10`, `11.99`, `12`, `13.99`, `14`, `15.99`, `16`, `17.99`, `18`, and `20`.
- Decimal comma input.
- Missing grades, all-zero coefficients, an empty class, duplicate names, and ties in ranking.
- Unauthorized same-school and cross-school access.
- Repeated idempotent requests and interrupted transactions.
- Offline mutation queue restart, retry, duplicate delivery, conflict logging, and reconnect.
- Existing-data migration and seed rerun.

Aim for at least 80% coverage on critical domain and application services, but do not optimize for a number at the expense of meaningful assertions. Never weaken, skip, or delete a test merely to make CI pass without explaining and fixing the underlying contract.

Before handoff, run the checks relevant to the changed packages. For high-risk cross-cutting changes, run lint, format check, typecheck, unit/integration tests, production build, and affected Playwright flows.

## 15. Performance and reliability budgets

Preserve or improve these roadmap benchmarks:

- Core pages usable within 5 seconds on a simulated 3G connection.
- Grade entry tested under 500 concurrent writes at the API benchmark layer.
- Excel import tested with 1,000 student rows.
- Bulk transcript PDF generation tested for a class of 60 students.
- Desktop smoke tests on Windows 10 and 11, Intel Core i3-class hardware, 4 GB RAM, and HDD storage.

Measure before optimizing. Avoid N+1 queries, unbounded lists, synchronous bulk work on the UI thread, repeated PDF recalculation, and unnecessary sync payloads.

## 16. Code quality and review rules

- Keep TypeScript strict. Do not use `any`, non-null assertions, or broad type casts to bypass a design problem without a documented reason.
- Prefer small pure functions, explicit dependencies, early returns, and domain-specific names.
- One main component/service/repository per file. Keep public exports intentional.
- Comments explain why, invariants, or non-obvious tradeoffs-not what the syntax already says.
- Do not leave dead code, commented-out implementations, debug logs, placeholder UI, or untracked TODOs. Link unavoidable TODOs to an issue or roadmap item.
- Use structured logs with correlation/request IDs and redacted metadata.
- Keep errors typed and preserve causes internally while returning safe public messages.
- Do not duplicate constants, permission matrices, grade formulas, or status transitions across layers.
- No raw SQL in route handlers. Any necessary raw SQL belongs in the data layer, is parameterized, reviewed, and covered by tests on both database engines where applicable.
- Do not use `dangerouslySetInnerHTML` unless sanitized, justified, and tested.
- Review migrations for data loss and rollback safety; review auth changes for session fixation, token leakage, and tenant bypass; review sync changes for replay and conflict behavior.

### Code review rules

Flag a change as blocking when it can:

- leak data across schools or users;
- produce an incorrect grade, average, rank, balance, receipt, transcript, or signature state;
- lose offline edits or make retries non-idempotent;
- mutate finalized/signed academic records or payments without an audit trail;
- bypass backend authorization or trust client-calculated official values;
- introduce an unreviewed destructive migration;
- expose secrets or unnecessary PII;
- break French-first or offline core workflows.

When flagging an issue, identify the concrete execution path, affected invariant, and safest correction. Do not report formatting preferences already enforced by automated tooling.

## 17. Git, commits, and documentation

- Branches: `main` for production, `develop` for integration, `feature/<name>` for features, and `fix/<name>` for bug fixes, unless the repository workflow says otherwise.
- Use focused conventional commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `perf:`, `chore:`.
- Do not commit secrets, `.env` files, real school data, local SQLite databases, generated PDFs containing real students, logs, build output, or IDE state.
- Update `.env.example` whenever configuration changes, using safe placeholders and explanatory comments.
- Add an ADR for decisions that change architecture, persistent data shape, security model, sync semantics, a major dependency, or a public contract.
- Update database documentation with schema changes and `CHANGELOG.md` when a milestone or user-visible behavior is completed.
- Keep documentation and commands executable and current; remove stale alternatives once a decision is approved.

## 18. Definition of done

A change is complete only when all applicable conditions are met:

- The requested acceptance criteria and current roadmap scope are satisfied.
- New behavior is covered by meaningful tests and all affected tests pass.
- No known critical bug remains: data loss, wrong computation, tenant leak, security bypass, or startup crash.
- Desktop behavior works offline; web behavior works online; sync degradation is visible and recoverable.
- All visible text is localized, with French complete and no placeholder strings.
- Backend and database validation enforce the domain rules; client validation improves usability but is not trusted.
- Seed data remains deterministic and runnable.
- Migrations are safe for non-empty SQLite and PostgreSQL databases.
- Relevant accessibility, low-spec performance, and failure states were checked.
- Documentation, ADRs, `.env.example`, and `CHANGELOG.md` were updated when applicable.
- The final diff contains no unrelated edits, secrets, debug artifacts, or generated junk.
- Verification performed and anything not verified are reported honestly.
- For a phase milestone, a non-developer school advisor has validated that the workflow is understandable.

## 19. When uncertain

Choose the path that protects school data, produces deterministic official records, works offline, and is easiest for a French-speaking school employee to understand. Do not invent domain policy. If ambiguity affects a grade formula, rank, payment, permission, transcript state, tenant boundary, sync conflict, or destructive migration, stop and request a decision or propose an ADR with explicit options.

The standard is not merely “the application runs.” The standard is that a school can trust it with a student’s academic future.
