# EduTrack Africa - Final Product and Delivery Roadmap

> Offline-first school records and bulletin software for Chad, built to become a broader African school platform only after the core product is proven.

| Field                | Value                                             |
| -------------------- | ------------------------------------------------- |
| Document             | Product and delivery roadmap                      |
| Version              | 2.0                                               |
| Date                 | 12 August 2026                                    |
| Owner                | Emmanuel Ouang-namou Adoum                        |
| Delivery model       | Solo founder/developer working with coding agents |
| Initial market       | Private collèges and lycées in N'Djamena        |
| Version 1 target     | Pilot launch after approximately 26 focused weeks |
| Version 1 validation | One complete school term after pilot launch       |
| Status               | Final implementation baseline                     |

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
5. Enter and validate one official subject grade per student and term.
6. Compute averages and class ranks deterministically.
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
| Workspace             | `pnpm` monorepo                                                             |
| Runtime               | Node.js 24 LTS, pinned in local development and CI                            |
| Product frontend      | React + TypeScript + Vite                                                     |
| Routing               | React Router                                                                  |
| API/server state      | TanStack Query                                                                |
| Forms                 | React Hook Form + Zod                                                         |
| Styling               | Tailwind CSS and shared accessible components                                 |
| Localization          | `i18next` + `react-i18next`; French default                               |
| Desktop shell         | Tauri 2                                                                       |
| Local API             | Fastify TypeScript application packaged as a Tauri sidecar                    |
| Validation            | Zod at all external boundaries                                                |
| ORM                   | Drizzle ORM                                                                   |
| Version 1 database    | SQLite through`better-sqlite3`                                              |
| Future cloud database | PostgreSQL behind the same repository contracts; not implemented in Version 1 |
| Authentication        | Self-hosted accounts,`jose`, rotating refresh sessions, bcrypt cost >= 12   |
| PDFs                  | `@react-pdf/renderer`                                                       |
| Excel                 | SheetJS (`xlsx`)                                                            |
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

### 4.1 Grade model

- Version 1 stores one official subject result per student, class-subject and term.
- It does not manage homework, tests or exam components. Schools may calculate those externally and enter/import the official term subject result.
- Accepted grades are `0.00` through `20.00`, inclusive.
- At input, comma and period are accepted as decimal separators.
- At persistence boundaries, a grade is an integer hundredths value: `14.50 -> 1450`.
- Coefficients are positive integers in Version 1.
- Weighted total uses integer arithmetic.
- Overall average is rounded half-up to two decimals.
- `10.00` reaches the pass threshold; `9.99` does not.
- Appreciation is represented by a code, translated in the UI and PDF.

### 4.2 Missing and optional grades

- Missing is distinct from zero.
- A provisional preview may show an explicitly labelled incomplete result.
- An official bulletin cannot be finalized while a required grade is missing or its subject submission is unvalidated.
- Optional subjects require explicit per-student subject enrolment.
- An optional subject is included only for a student enrolled in it.

### 4.3 Ranking

- Ranking uses the stored official average rounded to two decimals.
- Ties use competition ranking: `1, 1, 3`, not `1, 1, 2`.
- A deterministic secondary sort by stable student code and ID controls display only; it does not break equal ranks.
- Rankings are official within the same classroom and term. Version 1 does not publish school-wide rankings across incomparable levels.

### 4.4 Result and bulletin lifecycles

```text
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

| Phase      | Focus                                          |     Focused duration | Cumulative target |
| ---------- | ---------------------------------------------- | -------------------: | ----------------: |
| 0          | School discovery and pilot commitment          |              2 weeks |            Week 2 |
| 1          | Foundation and deployment proof                |              2 weeks |            Week 4 |
| 2          | School setup and authentication                |              2 weeks |            Week 6 |
| 3          | Students, guardians, teachers and import       |              3 weeks |            Week 9 |
| 4          | Classes, curriculum and enrolment              |              3 weeks |           Week 12 |
| 5          | Grade entry and validation                     |              3 weeks |           Week 15 |
| 6          | Calculation, ranking and bulletins             |              3 weeks |           Week 18 |
| 7          | Export, backup, restore and hardening          |              2 weeks |           Week 20 |
| 8          | Windows release candidate                      |              2 weeks |           Week 22 |
| 9          | Pilot onboarding and launch                    |               1 week |           Week 23 |
| Buffer     | Integration, illness, school delays and rework |              3 weeks |           Week 26 |
| Pilot term | Live validation and measured support           | 10–14 elapsed weeks |      Weeks 27–40 |

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
- [ ] Confirm that Version 1 may store one official subject result per term.
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

- [X] Initialize the `pnpm` monorepo and intended directories.
- [X] Pin Node.js 24 LTS through `.nvmrc`, `package.json#engines` and CI.
- [X] Configure strict TypeScript, ESLint, Prettier and import boundaries.
- [X] Configure Vitest, Testing Library and Playwright smoke tests.
- [X] Add `.env.example`, secret scanning and safe logging defaults.
- [X] Add GitHub Actions for format, lint, typecheck, unit tests and builds.
- [X] Create ADRs for Vite, Tauri, the Fastify sidecar and SQLite-only Version 1.

### 7.2 Deployment spike

- [X] Build a minimal React/Vite screen inside Tauri 2.
- [X] Launch a Fastify sidecar from Tauri and perform a health check.
- [X] Bind the sidecar to loopback only and reject unexpected origins/capabilities.
- [X] Load `better-sqlite3`, create the database under `AppData/EduTrack` and run a migration.
- [X] Package the sidecar as a self-contained Windows executable.
- [X] Select and document the WebView2 offline installation strategy.
- [X] Install on a clean offline Windows 10/11 machine without Node, Rust or developer tools.
- [X] Restart the application and verify persisted data remains intact.
- [X] Record the proven packaging mechanism in an ADR.

### 7.3 Database foundation

- [X] Create shared column conventions: UUID, `school_id`, timestamps, record version and soft-delete metadata.
- [X] Create `school`, `user`, `refresh_session`, `audit_log` and schema metadata migrations.
- [X] Create transaction and tenant-scoped repository primitives.
- [X] Create deterministic, idempotent seed infrastructure.
- [X] Test a two-school isolation fixture from the first tenant-owned query.

### 7.4 Gate

- [X] A clean clone passes install, typecheck, tests and production build.
- [X] An offline installer launches the UI, API and SQLite database.
- [X] A migration and rollback/recovery exercise passes on non-empty data.
- [X] The architecture does not require internet or a globally installed Node runtime.

## 8. Phase 2 - School setup and authentication

**Duration:** 2 weeks
**Outcome:** A SchoolMaster can log in locally and configure the school, year and terms without assistance.

### 8.1 Authentication slice

- [X] Implement SchoolMaster and Teacher roles; deny every other role in Version 1.
- [X] Hash passwords with bcrypt cost >= 12.
- [X] Implement login, refresh-session rotation, logout and password change.
- [X] Lock an account for 15 minutes after five failed attempts.
- [X] Keep access tokens in memory; never use `localStorage` for credentials.
- [X] Add SchoolMaster-driven local password reset for offline operation.
- [X] Enforce tenant and role authorization in application services.
- [X] Audit authentication-sensitive and role-management operations.

### 8.2 Setup wizard slice

- [X] Configure school name, short name, logo, address, city, phone, email, motto and ministry code.
- [X] Default country to Chad, currency to XAF, locale to French and timezone to `Africa/Ndjamena`.
- [X] Create an academic year with valid start/end dates.
- [X] Choose trimester or semester structure and create non-overlapping terms.
- [X] Enforce one current academic year per school and one current term within it.
- [X] Create class levels with code, order and exam-year flag.
- [X] Save after every step and resume an incomplete setup.
- [X] Show only implemented modules in navigation.

### 8.3 Gate

- [X] A new SchoolMaster completes setup offline in under 20 minutes using a usability script.
- [X] Same-school authorization and cross-school denial tests pass.
- [X] French validation, empty, error and recovery states are complete.
- [X] Restarting during setup loses no confirmed step.

## 9. Phase 3 - Students, guardians, teachers and import

**Duration:** 3 weeks
**Outcome:** A school can populate and maintain its essential people records quickly.

### 9.1 Data model

- [ ] Add `student`, `guardian`, `student_guardian` and `teacher` migrations.
- [ ] Make student and employee codes unique within a school.
- [ ] Separate record status from login-account status.
- [ ] Preserve audit metadata and prevent destructive deletion of referenced records.

### 9.2 Student and guardian slice

- [ ] Create searchable, paginated student list and profile views.
- [ ] Support name, date of birth, gender, contact, nationality, photo, code and status.
- [ ] Link several guardians to a student and siblings to the same guardian.
- [ ] Mark emergency and primary contacts.
- [ ] Archive and reactivate records with an audit reason.

### 9.3 Teacher slice

- [ ] Create searchable teacher list and profile views.
- [ ] Store minimal Version 1 data: name, code, contact, specialization, hire date and status.
- [ ] Create or deactivate a Teacher login independently of the teacher record.
- [ ] Prevent deletion when historical assignments or grades exist.

### 9.4 Import slice

- [ ] Provide French student and teacher Excel templates.
- [ ] Implement `upload -> parse -> preview -> validate -> confirm -> transact -> report`.
- [ ] Never persist during preview.
- [ ] Show row-level French errors and download rejected rows.
- [ ] Use student/employee codes for identity; never merge on name alone.
- [ ] Protect exports from spreadsheet formula injection.
- [ ] Make confirmed imports idempotent through an import identifier.

### 9.5 Gate

- [ ] Import 1,000 representative student rows without duplicate creation or partial corruption.
- [ ] Reimporting the same confirmed file is safe and reported clearly.
- [ ] Duplicate names remain valid and distinguishable by code.
- [ ] A non-developer finds, edits and archives a record without help.

## 10. Phase 4 - Classes, curriculum and enrolment

**Duration:** 3 weeks
**Outcome:** One complete school year structure can be prepared for grade entry.

### 10.1 Data model

- [ ] Add `subject`, `classroom`, `class_subject`, `class_enrollment` and `student_subject_enrollment`.
- [ ] Enforce tenant, academic-year and effective-date constraints.
- [ ] Store coefficients as positive integers and maximum grade as 20.00 policy.

### 10.2 Curriculum slice

- [ ] Create a school subject catalogue with localized display names, codes and categories.
- [ ] Create classrooms for an academic year and level.
- [ ] Assign subjects, coefficients and teachers to classrooms.
- [ ] Mark a class-subject optional without automatically assigning every student.
- [ ] Enrol applicable students in optional subjects explicitly.
- [ ] Extend the preview/validation/import pipeline to subjects, classrooms, class-subjects, coefficients and assignments.
- [ ] Copy a curriculum from a previous class/year with review before confirmation.

### 10.3 Enrolment slice

- [ ] Enrol one or many students in a classroom for the year.
- [ ] Prevent simultaneous active classroom enrolments for the same student/year.
- [ ] Transfer with effective date and reason while preserving history.
- [ ] Show class roster, capacity and students missing an active class.
- [ ] Export a basic class register.

### 10.4 Gate

- [ ] A SchoolMaster configures a realistic class and curriculum from a pilot fixture.
- [ ] Reimporting the same confirmed curriculum file is idempotent and does not duplicate assignments.
- [ ] Teacher assignment and optional-subject authorization tests pass.
- [ ] Transfer and historical-enrolment tests pass.
- [ ] The structure produces the exact subject rows expected on a reference bulletin.

## 11. Phase 5 - Grade entry and validation

**Duration:** 3 weeks
**Outcome:** Teachers enter and validate a complete class’s official term results quickly and safely.

### 11.1 Data model and lifecycle

- [ ] Add `transcript`, `transcript_line` and `grade_submission` migrations.
- [ ] Initialize transcripts idempotently for eligible student/class/term combinations.
- [ ] Initialize only subjects applicable to each student.
- [ ] Track entered-by, entered-at, updated-at and record version.
- [ ] Track subject/class/term validation separately from individual grade rows.

### 11.2 Teacher workflow

- [ ] Limit teachers to assigned class-subjects.
- [ ] Preselect the current term and remember the last valid working context.
- [ ] Provide a keyboard-first table with predictable Tab and Enter navigation.
- [ ] Accept `14,5` and `14.5`; normalize before validation.
- [ ] Save each valid edit locally using a short debounce, not a 30-second risk window.
- [ ] Show `Enregistrement…`, `Enregistré` and actionable failure states honestly.
- [ ] Preserve unsaved input through transient UI failures.
- [ ] Display missing, invalid, failing and complete states without relying only on color.
- [ ] Validate the complete subject submission and lock it read-only.

### 11.3 SchoolMaster controls

- [ ] View validation progress by class and subject.
- [ ] Reopen a validated submission only with a required reason.
- [ ] Audit validation, reopening and grade changes.
- [ ] Prevent edits to finalized transcripts until the authorized reopen flow completes.

### 11.4 Gate

- [ ] A teacher enters and validates 60 students using only keyboard navigation where practical.
- [ ] Forced application closure after a confirmed save loses no grade.
- [ ] Unauthorized teacher, student and cross-school access tests pass.
- [ ] Boundary tests cover every grade threshold and decimal comma input.

## 12. Phase 6 - Calculation, ranking and official bulletins

**Duration:** 3 weeks
**Outcome:** EduTrack produces official results identical to approved manual references.

### 12.1 Calculation engine

- [ ] Implement pure fixed-point appreciation, weighted-average, pass-threshold and ranking functions.
- [ ] Use the exact policy in `sms.md` and the approved grading ADR.
- [ ] Distinguish incomplete provisional previews from finalizable results.
- [ ] Block official calculation/finalization when required submissions or grades are missing.
- [ ] Store calculated values, policy version and computation timestamp.
- [ ] Recalculate a class transactionally and idempotently.
- [ ] Use competition ranking `1, 1, 3` for ties.

### 12.2 Review and finalization

- [ ] Show class results with average, appreciation, rank and completeness.
- [ ] Let the SchoolMaster review exceptions before finalization.
- [ ] Finalize immutable official values in one transaction.
- [ ] Require audited reopening to change a finalized result.
- [ ] Do not automatically print `ADMIS/AJOURNÉ` unless enabled by the approved school policy.

### 12.3 PDF engine

- [ ] Reproduce the school’s approved bulletin layout in French.
- [ ] Include school identity, year, term, student, class, subjects, grade, coefficient, points, average, appreciation and rank.
- [ ] Include physical director-signature and school-stamp areas.
- [ ] Generate PDF values from persisted finalized results; never recalculate in PDF-only code.
- [ ] Generate one student bulletin, a ZIP of individual bulletins and a combined class PDF.
- [ ] Use filesystem-safe unique filenames based on student code, not name alone.
- [ ] Mark provisional output visibly and prevent it from resembling a finalized official record.

### 12.4 Gate

- [ ] At least three reference classes match independently calculated expected results exactly.
- [ ] Boundary, tie, missing, optional-subject and zero-coefficient tests pass.
- [ ] A 60-student combined PDF completes within the target performance budget.
- [ ] A pilot administrator approves the printed layout and terminology.

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

Test `0`, `5.99`, `6`, `7.99`, `8`, `9.99`, `10`, `11.99`, `12`, `13.99`, `14`, `15.99`, `16`, `17.99`, `18` and `20`, plus comma input, missing values, duplicate names, optional subjects, ties and zero total coefficient.

### 17.3 Performance budgets

- Cold desktop startup reaches a usable login within eight seconds on target hardware.
- Ordinary local actions acknowledge within 300 milliseconds excluding bounded bulk operations.
- Search remains usable with 5,000 student records.
- Import 1,000 rows within 60 seconds with progress and bounded memory.
- Generate a combined 60-student bulletin PDF within two minutes.
- No unbounded query, list, upload, export or bulk operation.

These are release budgets to measure on representative hardware, not assumptions to claim without evidence.

## 18. Risk register

| Risk                                  | Likelihood   | Impact   | Mitigation                                                                      |
| ------------------------------------- | ------------ | -------- | ------------------------------------------------------------------------------- |
| Wrong grading or bulletin policy      | Medium       | Critical | Phase 0 fixtures, approved ADR, independent calculation samples                 |
| Incorrect official computation        | Medium       | Critical | Fixed-point pure functions, boundary fixtures, dual verification                |
| Data loss or corrupt restore          | Medium       | Critical | Atomic writes, verified rotating backups, clean-machine restore drills          |
| Tenant or role data leak              | Low–Medium  | Critical | Tenant-scoped repositories, deny-by-default services, isolation tests           |
| Pilot will not pay                    | Medium–High | High     | Price discussion before build, paid continuation gate, track support cost       |
| Teacher adoption failure              | Medium       | High     | Observed workflow, keyboard-first entry, early usability tests, narrow training |
| Windows sidecar/native-module failure | Medium       | High     | Phase 1 clean-machine deployment spike before feature investment                |
| Scope creep                           | Very high    | High     | Explicit Version 1 exclusions and evidence-gated Version 2                      |
| Messy Excel data                      | High         | High     | Preview, row errors, idempotency, reconciliation and rollback                   |
| Power loss during entry               | High         | High     | Near-immediate local persistence, transactional saves and restart tests         |
| Solo developer interruption/burnout   | Medium       | High     | Small vertical phases, three-week buffer, one pilot first, strict WIP limit     |
| AI-generated regression               | Medium       | High     | Required diff review, tests, no unverifiable completion claims                  |
| School response delays                | Medium       | Medium   | Primary and backup pilot, named coordinators, agreed review windows             |

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
