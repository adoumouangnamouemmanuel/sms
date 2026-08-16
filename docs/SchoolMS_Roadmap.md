# EduTrack Africa - Final Product and Delivery Roadmap

> Offline-first school records and bulletin software for Chad, built to become a broader African school platform only after the core product is proven.

| Field                | Value                                              |
| -------------------- | -------------------------------------------------- |
| Document             | Product and delivery roadmap                       |
| Version              | 2.1                                                |
| Date                 | 16 August 2026                                     |
| Owner                | Emmanuel Ouang-namou Adoum                         |
| Delivery model       | Solo founder/developer working with coding agents  |
| Initial market       | Private collèges and lycées in N'Djamena           |
| Version 1 target     | Pilot launch after approximately 26 focused weeks  |
| Version 1 validation | One complete school term after pilot launch        |
| Status               | Revised baseline (academic configuration redesign) |

> **Revision (16 August 2026):** the grading model was redesigned after reviewing real
> bulletins from two Chadian schools (Espérance and Elie Tao Baydo). The single
> subject-result assumption is replaced by a neutral, explicitly configured grading-policy
> model: assessment types and instances, derived results, one weighted subject result,
> configurable appreciation, and explicit scale/rounding policy. Phase 3 becomes _School &
> academic configuration_, Phase 4 becomes _People, enrolment & teaching assignments_,
> Phase 5 is **rebuilt** as _Assessment, grade entry & validation_, and Phase 6 becomes
> _Official results, ranking & bulletins_. Canonical design:
> `docs/academic/Academic_Configuration_Grading_Redesign.md`; sequenced structure:
> `docs/academic/EduTrack_Updated_Partial_Roadmap.md`. Completed work stays checked; new
> or reworked items are unchecked.

## 1. Product decision

EduTrack Africa will not begin as a complete school ERP. Version 1 will solve one narrow, expensive, trust-sensitive workflow exceptionally well:

> Configure a school, import its records, enter official term grades, calculate accurate results and rankings, print professional bulletins, and recover the data safely without internet.

The first paying customer is the school, not the student or parent. The first daily users are the SchoolMaster and teachers. Version 1 is a locally installed Windows product with an annual licence and onboarding/support service. Cloud features may later turn it into a hybrid local-first SaaS, but cloud dependency is not part of the first release.

### 1.1 Version 1 outcome

At the end of Version 1, a pilot school must be able to:

1. Install EduTrack on a low-spec Windows computer without internet.
2. Configure its identity, academic year, terms, levels, classes, subjects and coefficients.
3. Import or enter students, guardians and teachers.
4. Enrol students and assign teachers to class-subjects.
5. Configure a grading policy (assessment types, derived results, subject result, appreciation) and enter/validate per-student assessment results for a term.
6. Compute subject results, averages, appreciations and class ranks deterministically.
7. Finalize and print individual or class-wide official bulletins.
8. Export operational data to Excel.
9. Create, verify and restore local backups.
10. Operate for a complete term without data loss or internet dependency.

### 1.2 Explicitly excluded from Version 1

The following are not part of the first release:

- Student or parent accounts and portals
- React Native or any other mobile application
- Cloud synchronization or remote web access
- Finance, fee collection and payment receipts
- Teacher payroll or HR management
- Timetable and academic calendar
- Attendance
- Learning resources or LMS features
- SMS or push notifications
- Cryptographic/digital signatures
- Advanced cross-school analytics
- Subscription checkout or a free tier
- SuperAdmin and multi-school operations

These exclusions are scope protection, not cancelled ideas. A feature moves into development only after pilot evidence shows that it is more valuable than the alternatives.

## 2. Principles that govern every phase

### 2.1 Build vertical slices

After the minimum foundation is proven, build each capability through database, domain logic, API, interface and tests before beginning the next capability. Do not create all future tables, then all APIs, then all screens.

### 2.2 Validate before automating

Real school documents and workflows are the source of truth. Do not invent Chadian curriculum, grading, ranking or bulletin policy. Phase 0 must confirm the Version 1 grade model before its schema is frozen.

### 2.3 Offline is the default

Every Version 1 workflow reads and writes the local SQLite database. Internet loss must not block login, setup, grade entry, calculation, printing, export, backup or restore.

### 2.4 Official records must be deterministic

Official grades and calculations are never stored using uncontrolled binary floating-point values. Missing grades are never silently converted to zero. Finalized records cannot be edited in place. Every sensitive change is attributable and auditable.

### 2.5 French is complete from the first screen

French is the default product language. All user-visible text uses localization keys. Arabic and English are prepared structurally but do not delay Version 1 unless a pilot school requires them.

### 2.6 Simplicity beats theoretical completeness

The product must remain understandable to a school employee, maintainable by one developer and usable on 4 GB RAM with an HDD. New dependencies and abstractions must earn their complexity.

### 2.7 AI accelerates work but does not approve it

Coding agents may scaffold, implement, test, document and review. The developer remains responsible for domain decisions, security, migrations, final diffs, manual Windows checks and pilot acceptance. Generated code is untrusted until inspected and verified.

## 3. Locked Version 1 architecture

| Layer                 | Decision                                                                      |
| --------------------- | ----------------------------------------------------------------------------- |
| Workspace             | `pnpm` monorepo                                                               |
| Runtime               | Node.js 24 LTS, pinned in local development and CI                            |
| Product frontend      | React + TypeScript + Vite                                                     |
| Routing               | React Router                                                                  |
| API/server state      | TanStack Query                                                                |
| Forms                 | React Hook Form + Zod                                                         |
| Styling               | Tailwind CSS and shared accessible components                                 |
| Localization          | `i18next` + `react-i18next`; French default                                   |
| Desktop shell         | Tauri 2                                                                       |
| Local API             | Fastify TypeScript application packaged as a Tauri sidecar                    |
| Validation            | Zod at all external boundaries                                                |
| ORM                   | Drizzle ORM                                                                   |
| Version 1 database    | SQLite through`better-sqlite3`                                                |
| Future cloud database | PostgreSQL behind the same repository contracts; not implemented in Version 1 |
| Authentication        | Self-hosted accounts,`jose`, rotating refresh sessions, bcrypt cost >= 12     |
| PDFs                  | `@react-pdf/renderer`                                                         |
| Excel                 | SheetJS (`xlsx`)                                                              |
| Unit/component tests  | Vitest + Testing Library                                                      |
| End-to-end tests      | Playwright                                                                    |
| CI                    | GitHub Actions                                                                |

Vite produces the same product SPA for browser deployment and the Tauri WebView. Next.js is not used for the authenticated product. A separate public marketing site may use Next.js later if SEO justifies it.

### 3.1 Intended repository layout

```text
apps/
  api/                    Fastify transport and composition root
  web/                    React + Vite product SPA shared with desktop
  desktop/                Tauri shell and sidecar lifecycle
packages/
  domain/                 Pure entities, policies, calculations, state machines
  db/                     SQLite schema, migrations, repositories and seeds
  shared/                 Contracts, validation schemas, enums and utilities
  ui/                     Accessible localized components
docs/
  decisions/              Architecture Decision Records
  database/               Current schema documentation
scripts/                  Repeatable development, QA, backup and release scripts
```

### 3.2 Deployment model

```text
React/Vite UI
    -> loopback Fastify sidecar
        -> application services
            -> pure domain logic
                -> tenant-scoped repositories
                    -> SQLite in AppData/EduTrack
```

The sidecar binds only to loopback, validates the desktop origin/capability and shuts down with Tauri. The exact self-contained packaging mechanism is selected in Phase 1 only after `better-sqlite3`, migrations and clean-machine installation pass the deployment spike.

## 4. Final Version 1 domain decisions

These decisions remove ambiguity from implementation. A pilot finding may change one only through an ADR before dependent production data exists.

### 4.1 Grade model (revised by the academic configuration redesign)

- EduTrack records what teachers actually enter: per-student results against **assessment
  instances** (e.g. Devoir 1, Devoir 2, Composition) defined by a school-published grading
  policy. It never hard-codes a number of devoirs, a universal scale, or school-specific
  labels (`DEV_1`, `EVAL`, `Moy. Dev.`) as domain keys.
- A grading policy explicitly defines the scale (a `/20` template is offered for Chad but
  is never an implicit universal), pass threshold, decimal precision, rounding mode
  (`HALF_UP` or `TRUNCATE`), assessment types (repeatable with min/max occurrences, or
  single), derived results (V1 operation `MEAN`), exactly one official subject result with
  weights, and the appreciation scale. Nothing is assumed when no published policy
  resolves: grade entry is blocked for that scope.
- Accepted grades are `0.00` through the configured scale maximum, inclusive. Persistence
  keeps a physical CHECK upper bound at 2000 hundredths; the effective maximum comes from
  the configured scale.
- At input, comma and period are accepted as decimal separators.
- At persistence boundaries, a grade is an integer hundredths value: `14.50 -> 1450`.
- Coefficients are positive integers in Version 1.
- Weighted totals use integer fixed-point arithmetic, never unbounded binary floating point.
- Rounding/truncation happens only at explicitly defined domain boundaries, according to
  the configured policy; intermediate precision follows the configured rule.
- The pass threshold is configured per scale. For `/20` templates, `10.00` passes and
  `9.99` does not.
- Appreciation is configured per school (bands, labels, thresholds), versioned, and kept
  distinct from Mention/admission/promotion unless explicitly designed.

### 4.2 Missing, optional and non-graded results

- A result can be `GRADED`, `MISSING`, `ABSENT`, `EXCUSED` or `NOT_APPLICABLE`. Zero is a
  valid grade and never means missing; a blank UI state never silently becomes zero.
- The effect of `ABSENT`/`EXCUSED` on averages is not invented: it requires an explicit
  domain decision before calculation semantics are implemented.
- A provisional preview may show an explicitly labelled incomplete result.
- An official bulletin cannot be finalized while a required result is missing or its subject
  submission is unvalidated.
- Optional subjects require explicit per-student subject enrolment.
- An optional subject is included only for a student enrolled in it.

### 4.3 Ranking

- Ranking uses the stored official average rounded to two decimals.
- Ties use competition ranking: `1, 1, 3`, not `1, 1, 2`.
- A deterministic secondary sort by stable student code and ID controls display only; it does not break equal ranks.
- Rankings are official within the same classroom and term. Version 1 does not publish school-wide rankings across incomparable levels.

### 4.4 Policy, result and bulletin lifecycles

```text
Grading policy:
DRAFT -> PUBLISHED -> SUPERSEDED

Grade submission:
DRAFT -> SUBMITTED -> VALIDATED
   ^         |
   |         v
   +------ RETURNED

VALIDATED -> REOPENED -> SUBMITTED

Transcript:
DRAFT -> READY_FOR_REVIEW -> FINALIZED
             ^                  |
             |                  v
             +------------- REOPENED
```

- A policy version in use is immutable: edits create a new version and never retroactively
  change existing grades, calculations, validations, transcripts or PDFs.
- `READY_FOR_REVIEW` means all required subject submissions are validated and calculation succeeds.
- Finalization freezes the official values used by the PDF.
- Reopening requires SchoolMaster authorization, a reason and an audit event.
- Recalculation and re-finalization are explicit after reopening.
- Cryptographic `SIGNED` state is a Version 2 extension.

### 4.5 People and enrolment

- A student is a managed record in Version 1, not a login account.
- A guardian may be linked to several students through a join table.
- Teachers have accounts only when they need grade-entry access.
- Historical enrolments are preserved. Transfers create an effective-dated transition rather than overwriting history.
- Student and teacher records are archived/deactivated, not destructively deleted after use.

### 4.6 Tenancy and future synchronization

- `school_id` is a security boundary from the first migration.
- Tenant context comes from the authenticated session, never from an untrusted request body.
- Tenant-local unique constraints include `school_id`.
- Stable UUIDs, `created_at`, `updated_at`, `record_version` and `deleted_at` prepare records for later synchronization.
- Version 1 contains no mutation queue, cloud database or conflict resolver.

## 5. Capacity and schedule assumptions

The estimates assume:

- One developer working an average of 25–35 focused hours per week
- Regular use of coding agents for scaffolding, implementation, tests, documentation and review
- The developer reviews all changes and owns final integration
- No simultaneous major project competing for the same hours
- Pilot schools respond within agreed windows
- Scope remains limited to Version 1

AI materially reduces implementation time but does not eliminate discovery, architecture decisions, migration validation, manual QA, Windows packaging, school training or the duration of a school term.

### 5.1 Timeline summary

| Phase      | Focus                                          |    Focused duration | Cumulative target |
| ---------- | ---------------------------------------------- | ------------------: | ----------------: |
| 0          | School discovery and pilot commitment          |             2 weeks |            Week 2 |
| 1          | Foundation and deployment proof                |             2 weeks |            Week 4 |
| 2          | Authentication and authorization               |             2 weeks |            Week 6 |
| 3          | School & academic configuration (NEW)          |             3 weeks |            Week 9 |
| 4          | People, enrolment & teaching assignments       |             3 weeks |           Week 12 |
| 5          | Assessment, grade entry & validation (rebuilt) |             3 weeks |           Week 15 |
| 6          | Official results, ranking & bulletins          |             3 weeks |           Week 18 |
| 7          | Export, backup, restore and hardening          |             2 weeks |           Week 20 |
| 8          | Windows release candidate                      |             2 weeks |           Week 22 |
| 9          | Pilot onboarding and launch                    |              1 week |           Week 23 |
| Buffer     | Integration, illness, school delays and rework |             3 weeks |           Week 26 |
| Pilot term | Live validation and measured support           | 10–14 elapsed weeks |       Weeks 27–40 |

Target: pilot launch in approximately six months of focused work and a validated Version 1 after approximately nine months elapsed. At 15–20 focused hours per week, expect pilot launch in nine to twelve months.

## 6. Phase 0 - School discovery and pilot commitment

**Duration:** 2 weeks
**Outcome:** The product is grounded in real records, a defined grade policy and committed pilot schools.

### 6.1 Work

- [ ] Interview 8–10 school directors, administrators or teachers.
- [ ] Observe at least three complete workflows from grade collection to printed bulletin.
- [ ] Obtain at least three anonymized student/grade spreadsheets.
- [ ] Obtain at least three real bulletin templates from the target segment.
- [ ] Document who enters grades, validates them, computes results and approves printing.
- [ ] Confirm the grading model the pilot uses: assessment types per subject (devoirs, composition, evaluation), how the subject result is derived, scale and pass threshold, appreciation bands, rounding, tie ranking and missing-result policy.
- [ ] Confirm coefficient, appreciation, rounding, tie-ranking and missing-grade policies.
- [ ] Confirm whether term bulletins use `ADMIS/AJOURNÉ` or another school-specific decision label.
- [ ] Audit pilot hardware: Windows version, RAM, storage, printer and internet availability.
- [ ] Test the proposed setup fee, annual licence and support model.
- [ ] Secure two pilot commitments, with one primary and one backup school.
- [ ] Agree on confidentiality, anonymization, support contact and pilot success measures.
- [ ] Record the confirmed grade/bulletin policy in `docs/decisions/ADR-002-grading-policy.md`.

### 6.2 Gate

Do not freeze the grade schema until all of these are true:

- [ ] At least one real end-to-end workflow is documented.
- [ ] Reference Excel and bulletin fixtures are safely available.
- [ ] The grading ADR is approved.
- [ ] One pilot school has named a coordinator and agreed to the launch window.
- [ ] At least one decision-maker has discussed willingness to pay after the pilot.

## 7. Phase 1 - Foundation and deployment proof

**Duration:** 2 weeks
**Outcome:** The architecture runs as an installable offline vertical skeleton on a clean Windows machine.

### 7.1 Repository and quality foundation

- [x] Initialize the `pnpm` monorepo and intended directories.
- [x] Pin Node.js 24 LTS through `.nvmrc`, `package.json#engines` and CI.
- [x] Configure strict TypeScript, ESLint, Prettier and import boundaries.
- [x] Configure Vitest, Testing Library and Playwright smoke tests.
- [x] Add `.env.example`, secret scanning and safe logging defaults.
- [x] Add GitHub Actions for format, lint, typecheck, unit tests and builds.
- [x] Create ADRs for Vite, Tauri, the Fastify sidecar and SQLite-only Version 1.

### 7.2 Deployment spike

- [x] Build a minimal React/Vite screen inside Tauri 2.
- [x] Launch a Fastify sidecar from Tauri and perform a health check.
- [x] Bind the sidecar to loopback only and reject unexpected origins/capabilities.
- [x] Load `better-sqlite3`, create the database under `AppData/EduTrack` and run a migration.
- [x] Package the sidecar as a self-contained Windows executable.
- [x] Select and document the WebView2 offline installation strategy.
- [x] Install on a clean offline Windows 10/11 machine without Node, Rust or developer tools.
- [x] Restart the application and verify persisted data remains intact.
- [x] Record the proven packaging mechanism in an ADR.

### 7.3 Database foundation

- [x] Create shared column conventions: UUID, `school_id`, timestamps, record version and soft-delete metadata.
- [x] Create `school`, `user`, `refresh_session`, `audit_log` and schema metadata migrations.
- [x] Create transaction and tenant-scoped repository primitives.
- [x] Create deterministic, idempotent seed infrastructure.
- [x] Test a two-school isolation fixture from the first tenant-owned query.

### 7.4 Gate

- [x] A clean clone passes install, typecheck, tests and production build.
- [x] An offline installer launches the UI, API and SQLite database.
- [x] A migration and rollback/recovery exercise passes on non-empty data.
- [x] The architecture does not require internet or a globally installed Node runtime.

## 8. Phase 2 - Authentication and authorization

**Duration:** 2 weeks
**Outcome:** A SchoolMaster can log in locally, roles and permissions are enforced, and the identity/authorization foundation is ready before permanent school configuration is exposed.

### 8.1 Authentication slice

- [x] Implement SchoolMaster and Teacher roles; deny every other role in Version 1.
- [x] Hash passwords with bcrypt cost >= 12.
- [x] Implement login, refresh-session rotation, logout and password change.
- [x] Lock an account for 15 minutes after five failed attempts.
- [x] Keep access tokens in memory; never use `localStorage` for credentials.
- [x] Add SchoolMaster-driven local password reset for offline operation.
- [x] Enforce tenant and role authorization in application services.
- [x] Audit authentication-sensitive and role-management operations.
- [x] Ship the dedicated access module: typed permission catalog and pure `can()` (deny-by-default), `GET /access/permissions` with teacher-scoped classroom ids, web-shell and dashboard gating (completed under the former §11.2).

### 8.2 Setup wizard slice

- [x] Configure school name, short name, logo, address, city, phone, email, motto and ministry code.
- [x] Default country to Chad, currency to XAF, locale to French and timezone to `Africa/Ndjamena`.
- [x] Create an academic year with valid start/end dates.
- [x] Choose trimester or semester structure and create non-overlapping terms.
- [x] Enforce one current academic year per school and one current term within it.
- [x] Create class levels with code, order and exam-year flag.
- [x] Save after every step and resume an incomplete setup.
- [x] Show only implemented modules in navigation.

> The setup wizard remains the onboarding path (checked above). Phase 3 (§9.11) extends it
> into the full configuration onboarding with the same underlying services - no separate
> onboarding-only implementation, and the school/term/level steps are reconciled with the
> new configuration module instead of being duplicated.

### 8.3 Gate

- [x] A new SchoolMaster completes setup offline in under 20 minutes using a usability script.
- [x] Same-school authorization and cross-school denial tests pass.
- [x] French validation, empty, error and recovery states are complete.
- [x] Restarting during setup loses no confirmed step.

## 9. Phase 3 - School and academic configuration

**Duration:** 3 weeks
**Outcome:** A SchoolMaster can describe how the school is structured and how academic results are produced before teachers enter grades.

> This is a **new** phase created by the academic configuration redesign. It absorbs the
> levels/classrooms/subjects/curriculum work previously in the old Phase 4 and adds the
> neutral grading-policy and appreciation model that grade entry depends on. Canonical
> design: `docs/academic/Academic_Configuration_Grading_Redesign.md`. Existing setup-wizard
> work (school profile, year, terms, levels - §8.2) and the subject/classroom/curriculum
> tables from the former Phase 4 are reused and reconciled here, never duplicated.

### 9.1 Configuration foundation

- [x] Configuration module boundaries and one permanent `Configuration` area, also used by onboarding (no separate onboarding-only implementation).
- [x] Readiness/capability-gate model, enforced by the backend (UI gating alone is insufficient).
- [x] Versioning primitives and `DRAFT -> PUBLISHED -> SUPERSEDED` lifecycle where applicable.
- [x] Shared validation/error patterns and configuration audit events; French-first UX foundation.

### 9.2 School profile

- [x] Official name, short name, logo reference, contact/address and display language, reconciled with the setup-wizard profile step (§8.2) and editable from the permanent Configuration area (embedded profile editor, same `school` table and setup endpoint).
- [x] The profile fields bulletins need (header lines, school identity) are available here; the bulletin designer itself is Phase 6.

### 9.3 Academic year and periods

- [x] Academic-year lifecycle (`DRAFT -> ACTIVE -> CLOSED`), one active academic year per school.
- [x] School-defined period labels (1er/2e/3e Trimestre, Semestre 1/2, ...) with explicit ordering and configurable dates; reconcile the existing trimester/semester wizard step.

### 9.4 Levels and classrooms

- [x] Level as academic-structure scope (6ème, Terminale, ...); classroom as operational cohort (6ème A, Terminale C).
- [x] Curriculum and coefficients inherit from the level (level curriculum matrix, §9.5) rather than being duplicated per classroom; grading-policy inheritance lands with the policy scope resolution in §9.9.
- [x] Reconcile the existing level/classroom tables and UI from the former Phase 4 with this model.

### 9.5 Subjects and level curriculum

- [x] School-scoped subject catalogue: display name, short name, optional stable code, localization labels, active/archive state.
- [x] Level-subject applicability matrix (coefficient, required/optional, active) with backend validation of positive coefficients.
- [x] Reconcile existing `subject`/`class_subject`/coefficient work and the curriculum-copy flow.

### 9.6 Subject groups / sections

- [x] School-defined subject groups (Matières littéraires, Matières scientifiques, Formation humaine, ...).
- [x] Membership, display order and the admission/promotion flag where enabled; intuitive assignment UX.
- [x] Membership is school configuration - never inferred permanently from a universal subject category.

### 9.7 Grading policy domain model

- [ ] `grading_policy`: versioned (`DRAFT -> PUBLISHED -> SUPERSEDED`, `logical_policy_id` groups versions), with scale, pass threshold, precision, rounding mode and effective academic scope.
- [ ] Assessment type definitions: `SINGLE | REPEATABLE`, min/max occurrences, required flag, scale, display order.
- [ ] Derived result definitions (V1 operation `MEAN`; architecture may anticipate `WEIGHTED_MEAN`, `SUM`, `BEST_N`, `DROP_LOWEST_N` without exposing them).
- [ ] Exactly one official final subject result definition with weighted inputs.
- [ ] Calculation-graph validation: reject cycles, missing sources, invalid weights and incompatible scales before publishing.
- [ ] No hard-coded `DEV_1`/`EVAL`/`MOY_DEV` keys and no implicit defaults anywhere in the model.

### 9.8 Grading policy builder UX

- [ ] Template selection as editable starting points only (Devoirs + Composition, Contrôle continu + Composition, Note finale uniquement, Personnalisé) - never automatic defaults.
- [ ] Visual calculation flow with human-readable node settings; no formula syntax required for standard use.
- [ ] Advanced calculation options (precision/rounding) separated from common settings.
- [ ] Live sandbox (`Tester cette politique`) and plain-language explanation generated from configuration.
- [ ] Publish validation with actionable errors.

### 9.9 Policy assignment and inheritance

- [ ] Resolution: school default -> level -> level + subject; when no valid published policy resolves, grade entry is blocked for that scope.
- [ ] UX: inherited-policy indicator, `Personnaliser pour cette matière`, `Revenir à la politique héritée` (reverting never deletes policy versions already used).
- [ ] Tests prove deterministic resolution and no cross-school leakage.

### 9.10 Appreciation configuration

- [ ] Appreciation scales and bands (lower/upper bounds, fr/ar/en labels) with versioning.
- [ ] Overlap/gap validation, reordering and live preview.
- [ ] Kept distinct from Mention/admission/promotion until explicitly designed.

### 9.11 Configuration onboarding wizard

- [ ] Guided onboarding reusing the same components/services: Établissement -> Année scolaire -> Périodes -> Niveaux & classes -> Matières & coefficients -> Groupes de matières -> Politique de notation -> Appréciations -> Vérification.
- [ ] A new SchoolMaster reaches a grade-entry-ready school without developer or database intervention.

### 9.12 Configuration dashboard and readiness gates

- [ ] Dashboard of completed areas, warnings, blocking problems and capability readiness (people/enrolment, grade entry, submission, transcript calculation, PDF).
- [ ] Backend gates: classrooms need academic structure ready; curriculum needs levels + subjects; grade entry needs period + curriculum + published grading policy; transcript calculation needs validated submissions + valid calculation configuration.

### 9.13 Phase 3 gate

- [ ] Onboarding works end-to-end; a valid grading policy is published; policy inheritance resolves correctly; appreciation is configured.
- [ ] Grade-entry readiness can be determined and invalid/unconfigured scope is blocked with actionable French messages.
- [ ] Configuration survives restart; two-school isolation tests pass; no hard-coded three-devoir assumption remains in the production workflow.

## 10. Phase 4 - People, enrolment and teaching assignments

**Duration:** 3 weeks
**Outcome:** The configured academic structure is populated with the people and operational relationships required for grade entry.

> Renumbered from the former "Phase 3 - Students, guardians, teachers and import" plus the
> enrolment/assignment slices of the former Phase 4. Completed work stays checked below;
> only new or modified items are unchecked.

### 10.1 Students and guardians (reuse)

- [x] `student`, `guardian` and `student_guardian` migrations; codes unique within a school; record status separate from login-account status; audit metadata and no destructive deletion of referenced records.
- [x] Searchable, paginated list and profile views; name, date of birth, gender, contact, nationality, photo, code and status.
- [x] Link several guardians to a student and siblings to the same guardian; primary and emergency contacts.
- [x] Archive and reactivate records with an audit reason.

> Codes: `{school.code}-{academicYearStart}-{NNI}` generated at the service layer; an
> explicit code (including from the Excel import) overrides the default. Until a real NNI
> is available, the NNI segment falls back to a zero-padded per-school sequence counting
> archived rows so codes are never reused.

### 10.2 Teachers (reuse)

- [x] `teacher` migration; minimal Version 1 data (name, code, contact, specialization, hire date, status).
- [x] Searchable list and profile views; Teacher login created/deactivated independently of the teacher record; deletion prevented by the archive-only pattern plus restrict foreign keys.
- [x] Teachers ship as their own school module (`TEACHERS`), gated exactly like `STUDENTS`.

### 10.3 People import (reuse)

- [x] French student and teacher Excel templates (guardian template with optional student-code link column).
- [x] `upload -> parse -> preview -> validate -> confirm -> transact -> report`; nothing persisted during preview; row-level French errors with rejected-rows CSV; formula-injection protection; confirmed imports idempotent through an import identifier.
- [x] Codes (not names) establish identity; duplicate names remain valid.

> Implementation notes: `docs/import-guidelines.md`, `docs/import-templates/`, and the
> deterministic 1,000-row gate in `apps/api/src/test/imports.gate.test.ts`. Completed
> criteria: 1,000-row import without duplicate creation or partial corruption; idempotent
> reimport; a non-developer finds, edits and archives a record without help.

### 10.4 Student enrolment (reuse)

- [x] Enrol one or many students in a classroom for the year; one active classroom per student/year.
- [x] Transfer with effective date and reason while preserving history.
- [x] Class roster, capacity and students missing an active class; basic class register export.

### 10.5 Teacher subject assignments (reuse, scope note)

- [x] Assign teachers to class-subjects for the academic year - an operational concern, kept out of permanent academic configuration.
- [ ] Roster and grade-entry contexts resolve deterministically from configured curriculum + assignments once Phase 3 configuration is in place.

### 10.6 Phase 4 gate

- [x] Import gate: 1,000 rows without duplicates or partial corruption; reimport idempotent; duplicate names distinguishable by code.
- [x] Teacher assignment and optional-subject authorization tests pass; transfer and historical-enrolment tests pass.
- [x] A SchoolMaster configures a realistic class and curriculum from a pilot fixture (evidence: `docs/phase-4-gate.md`, `apps/api/src/test/phase4.gate.test.ts`).
- [ ] Grade-entry contexts can be generated from configuration + operations (depends on Phase 3).

## 11. Phase 5 - Assessment, grade entry and validation (REBUILT)

**Duration:** 3 weeks
**Outcome:** Teachers administer configured assessment types, enter marks efficiently, obtain deterministic computed results, submit academically complete results, and SchoolMaster review/validation works.

> This phase is **rebuilt** by the academic configuration redesign. The former single-result
> implementation (old §11.1–§11.5, committed on the Phase 5 branch) is not the permanent
> data model: `submission_result` is replaced by assessment instances + per-student
> assessment results under a published grading policy. The engineering patterns proven
> there are reused: authorization and tenant scoping, autosave, keyboard-first grid UX,
> submission lifecycle with mandatory return/reopen reasons, audit events,
> finalized-transcript locking, French-first errors, restart persistence, and the dedicated
> access/permissions module (now recorded under §8.1).

### 11.0 Legacy Phase 5 rollback/reconciliation

- [ ] Inspect existing migrations/schema/services/routes/UI/tests; identify reusable patterns; document the migration/reconciliation.
- [ ] Remove the single-result source of truth; establish assessment-instance + student-assessment-result as the one target source of truth (no indefinite dual-write).
- [ ] When migrating demo data, map legacy single results only to an explicitly configured single-result policy; never infer a universal policy.

### 11.1 Grade context and policy resolution

- [ ] Given teacher + year + term + class + subject: authorize the teacher, resolve the roster, resolve the pinned published grading-policy version, expose assessment definitions and current instances, expose readiness.
- [ ] Unconfigured scope cannot enter grades and receives an actionable French message.

### 11.2 Assessment instance management

- [ ] Create actual instances (Devoir 1..n, Composition, ...) per the resolved policy: repeatable creation with min/max enforcement (e.g. 2–6 devoirs), single-assessment rules, ordering, safe lifecycle, audit for deletion/closure once marks exist.

### 11.3 Student assessment-result persistence

- [ ] Per-student, per-assessment-instance results with states `GRADED | MISSING | ABSENT | EXCUSED | NOT_APPLICABLE`; zero persists as zero and is never confused with missing.
- [ ] Optimistic concurrency, tenant-scoped uniqueness, scale-validated ranges, audit where required. `ABSENT`/`EXCUSED` calculation semantics require an explicit decision before use.

### 11.4 Dynamic grade-entry grid

- [ ] One editable column per actual assessment instance; read-only derived columns; final subject-result preview; keyboard-first; decimal comma/point normalization; autosave with honest persistence state; restart recovery; 60-student performance target.
- [ ] Adding a fourth devoir adds the grade column without code/schema modification; never render the configured maximum number of columns up front.

### 11.5 Shared calculation engine

- [ ] Deterministic derived means, weighted final result, configured precision and rounding/truncation, range validation - pure shared domain functions used identically by UI preview and backend authoritative computation.
- [ ] Shared fixtures produce identical results in domain/API/UI paths.

### 11.6 Submission completeness engine

- [ ] Policy-aware completeness: minimum assessment occurrences, required singles, per-student result completeness, valid states, successful derived calculations.
- [ ] Machine-readable blocking reasons ("1 devoir sur un minimum de 2", "31 élèves sur 32 complets"), never a generic incomplete error.

### 11.7 Teacher submission

- [ ] `DRAFT -> SUBMITTED`: backend completeness re-check, transaction, audit, teacher editing locked, idempotent/retry-safe command semantics.

### 11.8 SchoolMaster validation dashboard

- [ ] Class/subject progress: teacher, policy, assessment coverage, student coverage, submission state, warnings.
- [ ] Opening a submission shows policy summary, administered assessments, completeness, student results, computed derived values, warnings, history and actions (`Valider`, `Retourner à l'enseignant`).

### 11.9 Return and resubmission

- [ ] `SUBMITTED -> RETURNED -> SUBMITTED`: SchoolMaster reason required, teacher sees the reason, editing re-enabled, audit, completeness re-evaluated on resubmission.

### 11.10 Validation

- [ ] `SUBMITTED -> VALIDATED`: SchoolMaster only, backend authoritative, audit, validated grades locked from teacher edits, becomes eligible input for Phase 6.

### 11.11 Reopening

- [ ] `VALIDATED -> REOPENED -> SUBMITTED`: authorized SchoolMaster, mandatory reason, audit, downstream transcript/finalization locks respected, no silent recalculation of official records.

### 11.12 Phase 5 gate

- [ ] Full workflow works offline: configure policy -> create instances -> enter -> restart -> grades persist -> computed values match fixtures -> incomplete submission blocked with precise explanation -> return/resubmit/validate/reopen all audited.
- [ ] Two schools with different labels/formulas remain fully isolated; the obsolete single-result assumption is absent from the production workflow; 60-student keyboard entry and forced-restart durability proven.

## 12. Phase 6 - Official results, ranking and bulletins

**Duration:** 3 weeks
**Outcome:** EduTrack consumes validated Phase 5 data and produces reproducible official academic records identical to approved manual references. PDF layout must never drive the grade-entry data model.

### 12.1 Official subject-result computation

- [ ] Consume validated per-student assessment results and pinned policy versions; persist official subject-result snapshots.
- [ ] No official computation from mutable draft grades; store calculated values, policy version and computation timestamp; recalculate a class transactionally and idempotently.

### 12.2 Section and overall calculations

- [ ] Subject coefficients, section/group subtotals, overall average, and admission average where configured (per §9.6 group configuration).
- [ ] Missing/non-applicable inclusion rules only after explicit approval; deterministic fixed-point arithmetic throughout.

### 12.3 Ranking and class statistics

- [ ] Competition ranking `1, 1, 3`; deterministic display order for ties; subject/class averages and min/max where required; official ranking scope per classroom/term.

### 12.4 Appreciation resolution

- [ ] Resolve configured appreciation with the pinned applicable scale/version; snapshot official display values for reproducibility.
- [ ] Keep appreciation distinct from Mention/admission/promotion unless explicitly designed.

### 12.5 Transcript lifecycle

- [ ] `DRAFT -> READY_FOR_REVIEW -> FINALIZED` with audited `REOPENED`; all required subject submissions validated before readiness; calculation succeeds; finalization freezes immutable official values in one transaction; reopening audited and recalculation explicit.
- [ ] Do not automatically print `ADMIS/AJOURNÉ` unless enabled by the approved school policy.

### 12.6 Annual result model

- [ ] Built from finalized term records, never re-entered manually; T1/T2/T3 are the actual per-term subject results, with school-specific annual presentation.
- [ ] Exact annual policy and layout require explicit approval before implementation.

### 12.7 Bulletin configuration

- [ ] Presentation configuration separate from academic calculation configuration: header, school identity, visible columns, labels, subject groups, rank/stat columns, appreciation, extra blocks, signatures/visa areas, term vs annual presentation.
- [ ] Reproduce the school's approved bulletin layout in French, including physical director-signature and school-stamp areas; no unrestricted layout engine.

### 12.8 PDF generation

- [ ] Generate values from persisted finalized snapshots only; deterministic/repeatable output; one student bulletin, a ZIP of individual bulletins and a combined class PDF.
- [ ] Filesystem-safe unique filenames based on student code, not name alone; mark provisional output visibly so it never resembles a finalized official record.

### 12.9 Gate

- [ ] A configured pilot school goes from validated grades to finalized official results and reproduces the same bulletin PDF without mutable-data drift.
- [ ] At least three reference classes match independently calculated expected results exactly; boundary, tie, missing, optional-subject and zero-coefficient tests pass.
- [ ] A 60-student combined PDF completes within the target performance budget; a pilot administrator approves the printed layout and terminology.

## 13. Phase 7 - Export, backup, restore and hardening

**Duration:** 2 weeks
**Outcome:** School data can be moved, protected and recovered without specialist intervention.

### 13.1 Export

- [ ] Export filtered student, teacher, class and grade data to Excel.
- [ ] Include school, academic context, export time and schema/version metadata.
- [ ] Escape formula-leading untrusted values.
- [ ] Keep exported PII to the minimum requested dataset.

### 13.2 Backup

- [ ] Create a manual backup from the application.
- [ ] Create rotating automatic local backups after startup and before migrations.
- [ ] Support a user-selected external/USB backup destination.
- [ ] Include database, approved school assets, manifest, schema version and checksum.
- [ ] Verify integrity before reporting success.
- [ ] Warn in French that backups contain confidential school records.

### 13.3 Restore

- [ ] Inspect and validate a backup before restoring.
- [ ] Reject unsupported, corrupted or wrong-school backups safely.
- [ ] Restore into a temporary location and validate before atomic replacement.
- [ ] Create a pre-restore recovery snapshot.
- [ ] Audit the actor, time, source and result.
- [ ] Provide a documented recovery procedure when the application cannot start normally.

### 13.4 Hardening

- [ ] Run security tests for authorization, tenant isolation, upload validation and log redaction.
- [ ] Test migrations and seeds on realistic non-empty data.
- [ ] Test forced shutdown during grade save, backup and restore.
- [ ] Complete French localization and accessibility review.
- [ ] Remove debug logs, placeholders, dead code and temporary feature flags.

### 13.5 Gate

- [ ] Restore a backup onto a clean second machine and reproduce sampled records and PDFs.
- [ ] Corrupted-backup and interrupted-restore tests preserve the original installation.
- [ ] No credentials, secrets or unnecessary PII appear in logs.
- [ ] All critical integration and end-to-end suites pass.

## 14. Phase 8 - Windows release candidate

**Duration:** 2 weeks
**Outcome:** A supportable installer is ready for real school machines.

### 14.1 Release engineering

- [ ] Produce a versioned Windows installer with an offline WebView2 strategy.
- [ ] Include the Tauri application, sidecar, migrations and required runtime assets.
- [ ] Store writable data only under the supported application-data directory.
- [ ] Add clean uninstall behavior that does not silently delete school data.
- [ ] Generate checksums and release notes.
- [ ] Define a manual, user-confirmed update and rollback procedure.
- [ ] Test upgrade from the previous release candidate with non-empty data.

### 14.2 Target-machine matrix

- [ ] Windows 10 and Windows 11
- [ ] 4 GB RAM, Intel Core i3-class processor and HDD
- [ ] Offline installation
- [ ] Standard and restricted user accounts where supported
- [ ] Common A4 printer and PDF printing
- [ ] Power loss/restart and unavailable backup destination

### 14.3 Gate

- [ ] Install, operate, upgrade and recover on at least three representative machines.
- [ ] Cold startup reaches a usable login within eight seconds on the target machine or has a documented measured exception.
- [ ] Ordinary local actions acknowledge within 300 milliseconds excluding bounded bulk operations.
- [ ] No installer step requires developer tools or internet.
- [ ] User and administrator operating guides are complete in French.

## 15. Phase 9 - Pilot onboarding and launch

**Duration:** 1 focused week plus a 10–14 week school term
**Outcome:** One primary and, when support capacity permits, one secondary school use EduTrack for a complete term.

### 15.1 Onboarding

- [ ] Sign the pilot and data-confidentiality agreement.
- [ ] Record baseline workflow time, error rate and printing effort.
- [ ] Install on approved machines and record hardware/software inventory.
- [ ] Import and reconcile real school data with signed approval.
- [ ] Configure local backup and perform a witnessed restore drill.
- [ ] Train the SchoolMaster and 3–5 teachers using real workflows.
- [ ] Assign one school coordinator and one support channel.

### 15.2 Live pilot

- [ ] Conduct weekly check-ins during setup/grade-entry periods and biweekly otherwise.
- [ ] Track defects, support time, user confusion and change requests separately.
- [ ] Fix critical data-integrity or security issues immediately.
- [ ] Do not add major modules during the term.
- [ ] Reconcile calculated results with an independent manual sample before printing.
- [ ] Produce the school’s term bulletins and obtain written acceptance.

### 15.3 Pilot success criteria

Version 1 is validated only if:

- [ ] 100% of sampled official calculations match approved expected results.
- [ ] There are zero known data-loss, tenant-leak or unauthorized-grade events.
- [ ] The school completes grade entry and bulletin production for one full term.
- [ ] Every confirmed save survives restart and defined failure tests.
- [ ] At least 80% of participating users say the workflow is easier than the previous process.
- [ ] Median support demand after onboarding is no more than two hours per school per week outside deadline week.
- [ ] Backup restore succeeds from the school’s actual procedure.
- [ ] The decision-maker agrees to a paid renewal, paid continuation or a documented price objection that can be tested.

### 15.4 Version 1 release gate

- [ ] All critical and high defects are closed or explicitly accepted with safe mitigation.
- [ ] Pilot feedback is prioritized by evidence, not enthusiasm.
- [ ] Installation, training and support effort are documented for pricing.
- [ ] Version 1.0 release notes, support policy and licence terms are ready.

## 16. Version 2 - Evidence-driven expansion

Version 2 is not a fixed calendar. Modules are selected using pilot demand, willingness to pay, dependency order and support cost.

### 16.1 Dependency order

When the evidence supports remote access, build platform capabilities in this order:

1. PostgreSQL repository adapter and cloud deployment
2. Automated cloud backup
3. Durable local mutation queue and idempotent sync API
4. Conflict detection, review and recovery
5. Multi-school administration and subscription enforcement
6. Remote web access
7. Student/parent portals and external notifications

A portal cannot precede the cloud identity, authorization and synchronization foundation it depends on.

### 16.2 Candidate modules

| Module                      | Entry evidence                                      | Important dependency                |
| --------------------------- | --------------------------------------------------- | ----------------------------------- |
| Finance and fee tracking    | Multiple pilot schools will pay for it              | Audit and receipt invariants        |
| Basic operational analytics | Repeated decision need not satisfied by exports     | Stable domain metrics               |
| Cloud backup                | Schools accept recurring cloud cost                 | PostgreSQL and encryption           |
| Multi-school sync           | More than one installation needs shared/remote data | Queue, idempotency, conflict review |
| Student/parent portal       | Schools identify real users and support ownership   | Cloud auth and web access           |
| SMS/notifications           | Verified Chad delivery, price and opt-in process    | Cloud events and cost controls      |
| Timetable/calendar          | Repeated pilot demand                               | Teacher/class schedule data         |
| Digital verification        | Institutions accept the trust model                 | Key lifecycle and public verifier   |
| Payroll/HR                  | Paying demand and local payroll policy discovery    | Finance-grade auditability          |
| Learning resources          | Clear adoption owner and content workflow           | Portal and storage                  |

No free tier is assumed. Test a hybrid model of setup/data migration, annual school licence, optional support and later optional cloud service.

## 17. Quality strategy

### 17.1 Required test layers

- Unit: fixed-point calculations, thresholds, ranking, state transitions, permissions and validation.
- Repository integration: constraints, transactions, tenant scoping and non-empty migrations.
- API integration: auth, idempotency, imports, validation, finalization and restore orchestration.
- Component: French states, keyboard grade entry, forms and accessibility.
- End-to-end: setup, import, enrolment, grade entry, finalization, PDF, backup and restore.
- Manual: clean Windows install, printer output, restricted connectivity and target hardware.

### 17.2 Mandatory grade fixtures

Test `0`, `5.99`, `6`, `7.99`, `8`, `9.99`, `10`, `11.99`, `12`, `13.99`, `14`, `15.99`, `16`, `17.99`, `18` and `20`, plus comma input, missing values, duplicate names, optional subjects, ties and zero total coefficient. Boundary values apply against the configured scale, appreciation bands and rounding mode once those are configurable (§9.7/§9.10); fixtures must also cover truncation vs half-up and every result state (`MISSING`, `ABSENT`, `EXCUSED`, `NOT_APPLICABLE`).

### 17.3 Performance budgets

- Cold desktop startup reaches a usable login within eight seconds on target hardware.
- Ordinary local actions acknowledge within 300 milliseconds excluding bounded bulk operations.
- Search remains usable with 5,000 student records.
- Import 1,000 rows within 60 seconds with progress and bounded memory.
- Generate a combined 60-student bulletin PDF within two minutes.
- No unbounded query, list, upload, export or bulk operation.

These are release budgets to measure on representative hardware, not assumptions to claim without evidence.

## 18. Risk register

| Risk                                  | Likelihood  | Impact   | Mitigation                                                                      |
| ------------------------------------- | ----------- | -------- | ------------------------------------------------------------------------------- |
| Wrong grading or bulletin policy      | Medium      | Critical | Phase 0 fixtures, approved ADR, independent calculation samples                 |
| Incorrect official computation        | Medium      | Critical | Fixed-point pure functions, boundary fixtures, dual verification                |
| Data loss or corrupt restore          | Medium      | Critical | Atomic writes, verified rotating backups, clean-machine restore drills          |
| Tenant or role data leak              | Low–Medium  | Critical | Tenant-scoped repositories, deny-by-default services, isolation tests           |
| Pilot will not pay                    | Medium–High | High     | Price discussion before build, paid continuation gate, track support cost       |
| Teacher adoption failure              | Medium      | High     | Observed workflow, keyboard-first entry, early usability tests, narrow training |
| Windows sidecar/native-module failure | Medium      | High     | Phase 1 clean-machine deployment spike before feature investment                |
| Scope creep                           | Very high   | High     | Explicit Version 1 exclusions and evidence-gated Version 2                      |
| Messy Excel data                      | High        | High     | Preview, row errors, idempotency, reconciliation and rollback                   |
| Power loss during entry               | High        | High     | Near-immediate local persistence, transactional saves and restart tests         |
| Solo developer interruption/burnout   | Medium      | High     | Small vertical phases, three-week buffer, one pilot first, strict WIP limit     |
| AI-generated regression               | Medium      | High     | Required diff review, tests, no unverifiable completion claims                  |
| School response delays                | Medium      | Medium   | Primary and backup pilot, named coordinators, agreed review windows             |

## 19. Definition of done

A task is done only when its acceptance criteria, relevant tests, localization, security and documentation are complete. A phase is done only when:

1. Every gate item has evidence.
2. The vertical workflow works end-to-end in its intended offline environment.
3. Relevant unit, integration, component and end-to-end tests pass.
4. No known data-loss, wrong-computation, authorization or startup defect remains.
5. Tenant scoping and audit behavior are verified where applicable.
6. French user-visible content and error/recovery states are complete.
7. Migrations and seeds work on non-empty representative data.
8. Performance was measured where the phase introduces a budget-sensitive path.
9. The final diff contains no secrets, debug artifacts, placeholders or unrelated edits.
10. `sms.md`, ADRs, database docs, `.env.example` and `CHANGELOG.md` are updated when affected.
11. Commands and manual checks actually run are reported; unverified items are named honestly.
12. A school advisor accepts user-facing milestone behavior where applicable.

Roadmap checkboxes record intended work, not proof by themselves. Coding agents must not mark a phase complete unless the user explicitly asks and the gate evidence is available.

## 20. North-star rule

When speed, feature count and trust conflict, choose trust. EduTrack Africa succeeds when a school can print a student’s bulletin, restore its records after failure and confidently say that the result is correct.
