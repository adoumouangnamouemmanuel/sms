# EduTrack Africa - Product and System Specification

**Document version:** 2.1
**Status:** Revised baseline (academic configuration redesign)
**Updated:** 16 August 2026
**Owner:** Emmanuel Ouang-namou Adoum
**Related documents:** `SchoolMS_Roadmap.md`, `AGENTS.md`, accepted ADRs in `docs/decisions/`, `docs/academic/Academic_Configuration_Grading_Redesign.md`

> **Revision (16 August 2026):** after reviewing real bulletins from two Chadian schools
> (Espérance and Elie Tao Baydo), the single-result grade model is replaced by a neutral,
> explicitly configured grading-policy model: assessment types and instances, derived
> results, one weighted subject result, configurable appreciation, and explicit
> scale/rounding policy. There is no implicit grading scheme: a school must publish a valid
> grading policy before grade entry is enabled for the covered scope. Phase 3 of the
> roadmap implements this configuration; Phase 5 is rebuilt on top of it. The canonical
> design lives in `docs/academic/Academic_Configuration_Grading_Redesign.md`; this
> document is updated to match.

## 1. Purpose and authority

This document is the authoritative product, domain and system-design specification for EduTrack Africa. It replaces the previous `sms.md` currently saved in docs/archive and supersedes `SchoolMS_UML_Design.md`, which remains only as a legacy design snapshot if it is retained in the repository.

Use this document to answer what the system must do and how its core boundaries behave. Use `SchoolMS_Roadmap.md` for when the work is delivered and the evidence required at each phase. Use accepted Architecture Decision Records (ADRs) for decisions that deliberately override this baseline.

When implementation and this specification conflict, report the conflict. Do not silently reinterpret an official grade, authorization, audit, backup or record-lifecycle rule to fit existing code.

## 2. Product definition

EduTrack Africa is a French-first, offline-first school administration product designed initially for secondary schools in Chad. Version 1 runs locally on Windows and gives school staff a dependable path from academic setup to official printed term bulletins.

The product is designed for:

- unreliable or absent internet;
- Windows 10 and 11 computers with modest hardware;
- staff who may have limited technical experience;
- French as the default working language;
- academic records that must remain correct, reviewable and recoverable for years.

The product promise is narrow and concrete: a school can set up its academic structure, manage students and teaching assignments, collect and validate official term results, calculate deterministic outcomes, print correct bulletins and recover the data after a machine failure.

## 3. Version 1 scope

### 3.1 Included capabilities

Version 1 includes:

1. School installation and initial setup.
2. School identity, logo and bulletin configuration.
3. Academic years and non-overlapping terms.
4. SchoolMaster and Teacher accounts.
5. Student, guardian and teacher records.
6. Class levels, classrooms, subjects, subject groups, level curricula, coefficients and teacher assignments.
7. Class enrollment and optional-subject enrollment.
8. Spreadsheet preview, validation and confirmed import for core records.
9. A school-published grading policy (scale, assessment types, derived results, weighted subject result, appreciation) and per-student assessment results producing one official subject result per class-subject and term.
10. Teacher draft entry per assessment instance, submission and SchoolMaster validation/return.
11. Fixed-point derived results, subject results, average, appreciation, pass/fail and competition ranking.
12. Provisional transcript review and finalized official PDF bulletins.
13. CSV/XLSX export, append-only audit history and verified backup/restore.
14. A Windows installer and documented fully offline installation path.

### 3.2 Explicit exclusions

Version 1 does not include:

- cloud synchronization or cloud hosting;
- web access from multiple devices;
- finance, fees, payments, receipts or accounting;
- attendance;
- payroll or human-resources workflows;
- timetable generation;
- learning-resource management;
- parent or student accounts and portals;
- native mobile applications;
- SMS, WhatsApp or email automation;
- online subscription billing;
- cryptographic document signatures;
- a platform-wide SuperAdmin workflow.

Excluded modules must not appear as unfinished navigation, dormant endpoints or speculative data flows. They require evidence from the pilot, explicit approval and usually an ADR before implementation.

## 4. Actors and permissions

### 4.1 SchoolMaster

The SchoolMaster is the authorized school administrator for one school. The role may:

- complete school and academic setup;
- configure, publish and supersede grading policies and appreciation scales;
- create, deactivate and reset Teacher accounts;
- manage students, guardians, teachers, classes, subjects and enrollments;
- assign teachers to class-subjects;
- import and export permitted school data;
- view all grade-entry progress within the school;
- validate or return submitted grade sets;
- reopen validated grades with a required reason;
- review and finalize bulletins;
- reopen finalized transcripts with a required reason;
- create, inspect and restore backups;
- view the school's audit history.

The SchoolMaster may not cross the school's tenant boundary, erase append-only audit history or silently rewrite finalized records.

### 4.2 Teacher

A Teacher may:

- sign in to the local installation;
- see only assigned class-subjects and relevant enrolled students;
- enter, save and recover draft results for those assignments;
- submit a complete class-subject term result set;
- respond to a returned submission while it is editable;
- view the final validated status relevant to their assignments.

A Teacher may not manage accounts, change academic structure, validate their own submission, view unrelated class-subjects, finalize bulletins, restore backups or access another school.

### 4.3 Student and guardian

Students and guardians are managed records, not authenticated users in Version 1. Their information appears only where the SchoolMaster or an assigned Teacher is authorized to use it.

## 5. System context and deployment

### 5.1 Runtime topology

The Version 1 desktop installation contains:

1. A Tauri 2 desktop shell.
2. The compiled React/Vite frontend.
3. A packaged Fastify TypeScript/Node sidecar.
4. One local SQLite database.
5. Tenant-scoped application-data folders for backups, temporary imports and generated records.

The frontend communicates with the sidecar over loopback HTTP only. The sidecar binds to `127.0.0.1` on a random available port and authenticates all requests using installation/session material unavailable to ordinary web pages. It must not bind to the LAN.

The exact self-contained packaging mechanism for the Node sidecar is an implementation decision proven during the roadmap's deployment spike and captured in an ADR. The accepted mechanism must work on a clean supported Windows machine without requiring the school to install Node.js or use the internet.

### 5.2 Persistence semantics

SQLite is the Version 1 system of record. A UI action is confirmed only after the corresponding database transaction commits. The application must never display a successful save when data exists only in component state or an uncommitted request.

Core work remains available without internet after installation. No Version 1 workflow may wait for a cloud service.

### 5.3 Future-ready boundaries

Every tenant-owned record carries `school_id`, and critical mutable records may carry version/synchronization metadata. These fields protect boundaries and reduce future migration risk; they do not make Version 1 a sync product.

PostgreSQL repositories, cloud APIs, synchronization queues and conflict resolution belong to Version 2 and require separate design evidence.

## 6. Technical baseline

| Concern              | Approved baseline                                  |
| -------------------- | -------------------------------------------------- |
| Workspace            | `pnpm` monorepo                                    |
| Runtime              | Node.js 24 LTS                                     |
| Language             | Strict TypeScript; Rust only for Tauri integration |
| UI                   | React and Vite                                     |
| Routing              | React Router                                       |
| Server state         | TanStack Query                                     |
| Forms                | React Hook Form                                    |
| Validation           | Zod                                                |
| Styling              | Tailwind CSS                                       |
| Localization         | `i18next` and `react-i18next`                      |
| Desktop              | Tauri 2                                            |
| Local service        | Fastify sidecar                                    |
| ORM                  | Drizzle ORM                                        |
| Version 1 database   | SQLite via `better-sqlite3`                        |
| Authentication       | `jose`, rotating refresh sessions, bcrypt          |
| PDF                  | `@react-pdf/renderer`                              |
| Spreadsheet          | SheetJS (`xlsx`)                                   |
| Unit/component tests | Vitest and Testing Library                         |
| End-to-end tests     | Playwright                                         |
| CI                   | GitHub Actions                                     |

Next.js is not part of the product stack. The shared product interface is a client-rendered Vite application because the desktop runtime is central and Version 1 needs no server-rendering features.

## 7. Logical architecture

Use these responsibility boundaries:

```text
React UI
  -> transport and Zod validation
    -> Fastify route
      -> application service
        -> domain policy / pure calculation
          -> repository
            -> SQLite
```

### 7.1 UI layer

The UI renders localized workflows, captures input and communicates persistence state. It may calculate a non-authoritative preview using shared domain functions but never becomes the source of official authorization or persisted results.

### 7.2 Transport layer

Fastify routes authenticate requests, validate path/query/header/body data, map transport types and call one or more application services. They contain no raw database access and no official academic calculation.

### 7.3 Application layer

Application services enforce permissions, tenant boundaries, lifecycle transitions, transactions, idempotency and audit creation. They orchestrate domain and repository interfaces.

### 7.4 Domain layer

Pure domain code owns grade parsing, fixed-point arithmetic, appreciation, pass/fail, ranking, completeness checks and allowed state transitions. It has no React, HTTP, filesystem or database dependency.

### 7.5 Persistence layer

Repositories own queries, row mapping and persistence-specific behavior. Tenant-owned repository methods require a trusted tenant context. ORM rows are never returned directly from public routes.

## 8. Repository topology

```text
apps/
  api/                  Fastify sidecar and application services
  web/                  React/Vite product frontend
  desktop/              Tauri shell and desktop integration
packages/
  domain/               Pure domain rules, calculations, transitions
  db/                   Drizzle schema, migrations, repositories, seeds
  shared/               Transport types, constants, validation schemas
  ui/                   Reusable localized accessible components
docs/
  decisions/            Accepted ADRs
  database/             Schema and migration documentation
scripts/                Repeatable development, build and release tasks
```

Dependencies point inward. Domain code does not import from applications or adapters. Cross-module interaction uses typed service interfaces rather than direct access to another module's tables.

## 9. Domain modules

Version 1 contains six product modules:

1. Installation, school and academic configuration (structure, grading policy, appreciation, readiness gates).
2. Authentication, authorization and auditing.
3. People: students, guardians and teachers.
4. Curriculum: levels, classrooms, subjects, subject groups, assignments and enrollments.
5. Results: assessment instances, entry, submission, validation, computation, ranking and transcripts.
6. Data safety: import, export, backup and restore.

The modules excluded from Version 1 are not empty shells. Version 2 introduces new modules only after their dependencies and policies are accepted.

## 10. Data model conventions

### 10.1 General conventions

- Primary keys are UUIDs.
- Database fields use `snake_case`; TypeScript uses `camelCase`.
- Tenant-owned tables contain a non-null `school_id` foreign key.
- Times are stored in UTC and displayed using the school's configured timezone.
- Business dates use date-only values where time-of-day has no meaning.
- Archivable records use an explicit active/archived state and timestamps.
- Critical mutable records use `version` or equivalent optimistic-concurrency metadata.
- Created/updated timestamps are present where history or synchronization may depend on them.
- User-visible codes are stable, unique within a school and never inferred from names.
- Real student or school data is forbidden in seeds and tests.

### 10.2 Fixed-point academic values

Persist official numeric academic values as scaled integers:

- grade/result `10.25` is stored as `1025` hundredths;
- coefficient `2.00` is stored as `200` hundredths;
- official average `13.47` is stored as `1347` hundredths.

The domain library defines the exact intermediate scale and safe-integer checks for multiplication/division. Official records must never depend on unbounded binary floating-point arithmetic.

## 11. Core entities and relationships

This section specifies required concepts, not final SQL column spelling. The implemented schema and migrations must preserve these constraints.

### 11.1 School and academic structure

#### `school`

Represents one tenant and installation owner. Important attributes include name, stable code, address, contact details, logo reference, locale, timezone, bulletin settings and active state.

#### `academic_year`

Belongs to one school and contains label, start date, end date and status (`DRAFT -> ACTIVE -> CLOSED`). Constraints:

- start precedes end;
- tenant-local label is unique;
- at most one academic year is current per school;
- historical years are preserved.

#### `term` (academic period)

Belongs to an academic year and school. Contains school-defined label/order (1er Trimestre, 2e Trimestre, Semestre 1, ...), start/end dates and status. Constraints:

- term dates fall inside the academic year;
- terms in the same academic year do not overlap;
- ordering is unique within the academic year;
- at most one term is current within the school's current academic context;
- dates are configurable but never the only determinant of academic state.

#### `class_level`

Represents a curriculum level such as `6e` or `Terminale`. The tenant-local code/name is unique. Levels can be deactivated but historical references remain.

#### `classroom`

Represents a cohort/section within an academic year, such as `3e A`. It belongs to a school, academic year and class level. Its tenant/year code is unique.

### 11.2 Identity, sessions and audit

#### `user`

Belongs to a school and has role `SCHOOL_MASTER` or `TEACHER`, username/login identifier, password hash, active/locked state, failed-attempt metadata and timestamps. A Teacher user links to exactly one teacher record when active.

#### `refresh_session`

Tracks a hashed rotating refresh token/session family, user, expiry, revocation, replacement relationship and safe device metadata. Reuse of a rotated token revokes the affected family.

#### `audit_log`

Append-only event containing school, actor, action, target type/id, time, request/correlation ID and redacted structured metadata. Audit rows are never updated or deleted by normal product workflows.

### 11.3 People

#### `student`

Belongs to a school. Contains stable tenant-local student code, legal/display name fields, sex where lawfully required, date/place of birth, contact/address data where approved, status and archival timestamps. Duplicate names are permitted. The code, not the name, identifies the student in operational workflows.

#### `guardian`

Belongs to a school and represents a parent or responsible adult. Contains name, relationship/contact information and active state.

#### `student_guardian`

Many-to-many link between student and guardian. Records relationship type, primary-contact flag and authorization/notes allowed by the privacy policy. A guardian may relate to several students and a student may have several guardians.

#### `teacher`

Belongs to a school and contains stable staff code, names, contact details, active state and optional linked user account. Payroll data is out of scope.

### 11.4 Curriculum and enrollment

#### `subject`

Belongs to a school. Contains stable code, localized name, optional short label and active state.

#### `subject_group` (bulletin section)

A school-defined grouping of subjects such as Matières littéraires, Matières scientifiques or Formation humaine. Contains name, short label, display order and, where the school enables it, whether the group counts toward an admission/promotion average. Membership is school configuration and must never be inferred permanently from a universal subject category.

#### `level_subject` (level curriculum)

Determines whether a subject is taught at a class level and its coefficient there, plus required/optional applicability and active state. Curriculum, coefficients and grading policy are defined at level scope and inherited by classrooms, so identical configuration is never duplicated across 6ème A, 6ème B and 6ème C.

#### `class_subject`

Resolves a level curriculum subject to one classroom for an academic year, with the level's coefficient/applicability, optional assigned Teacher and active state. The classroom/subject combination is tenant-locally unique in the relevant academic context.

Changing a coefficient after validated results exist requires explicit policy and audit; it must never silently alter finalized transcripts.

#### `class_enrollment`

Links student, classroom and academic year, with enrollment status and dates. Constraints:

- historical enrollments are retained;
- a student has at most one active classroom enrollment in a given academic year unless an ADR explicitly supports another model;
- promotion, transfer, dropout and graduation use controlled status transitions rather than destructive updates.

#### `student_subject_enrollment`

Links a student/class enrollment to an optional class-subject. Required subjects are applicable by class configuration; optional subjects are applicable only through this active link.

### 11.5 Grading policy, results and transcripts

#### `grading_policy` (versioned)

Describes how subject results are produced for a school scope. Contains scale, pass threshold, decimal precision, rounding mode, effective academic scope, status (`DRAFT | PUBLISHED | SUPERSEDED`) and version metadata. `logical_policy_id` groups versions of the same conceptual policy. A policy version in use is immutable: edits create a new version and never retroactively change existing grades, calculations, validations, transcripts or PDFs.

#### `assessment_type_definition`

A category of marks teachers record, configured by the school (Devoir, Composition, Projet, Oral, TP, Interrogation). Contains name/short name, scale, occurrence mode (`SINGLE | REPEATABLE`), min/max occurrences, required flag and display order. Example: Devoir, /20, REPEATABLE, min 2, max 6.

#### `assessment_instance`

An operational assessment created for a class-subject/term, such as Devoir 1, Devoir 2, Composition. Belongs to the resolved policy version, references the assessment type, sequence number, title, optional date and scale snapshot. The number of instances is never hard-coded; a repeatable type cannot exceed its configured maximum. Existing instances with entered grades cannot be silently deleted.

#### `derived_result_definition`

A calculated intermediate (e.g. Évaluation = mean of all Devoir instances), not manually typed. Contains name/short name, operation, source definitions, precision and rounding mode. Version 1 supports the `MEAN` operation; the architecture may anticipate `WEIGHTED_MEAN`, `SUM`, `BEST_N` and `DROP_LOWEST_N` without exposing them.

#### `subject_result_definition`

Exactly one per policy: the official subject result with weighted inputs (e.g. Évaluation 50% + Composition 50%, or Note finale 100%). Policy publication validates the calculation graph (no cycles, all sources exist, weights valid, scales compatible).

#### `student_assessment_result`

One active result per student and assessment instance. Contains state (`GRADED | MISSING | ABSENT | EXCUSED | NOT_APPLICABLE`), fixed-point grade, entered-by/at, updated-at and record version. Zero is a valid grade and never means missing. The effect of `ABSENT`/`EXCUSED` on averages requires an explicit approved domain decision before calculation semantics are implemented.

#### `appreciation_scale` and `appreciation_band`

A school-configured, versioned mapping of official averages to labels (e.g. 16.00 -> Très bien), with fr/ar/en labels. Published scales used by official records are versioned; changes never mutate historical finalized records. Appreciation stays distinct from Mention/admission/promotion until explicitly designed.

#### `policy_assignment`

Binds a published policy version to a scope: school default, level, or level + subject. Resolution order is school default -> level -> level + subject. If no valid published policy resolves for a grade-entry scope, grade entry is blocked for that scope - never silently assumed.

#### `grade_submission`

Represents a Teacher's class-subject result set for one term under a pinned policy version. It contains school, term, class-subject, assigned Teacher, pinned policy version, status, version, submitted/validated/returned/reopened metadata and reason fields.

Allowed status flow:

```text
DRAFT -> SUBMITTED -> VALIDATED
   ^         |
   |         v
   +------ RETURNED

VALIDATED -> REOPENED -> SUBMITTED
```

Only the assigned Teacher edits draft/returned/reopened results. Only the SchoolMaster validates, returns or reopens. Every transition is authorized and audited. Submission completeness is policy-aware: minimum assessment occurrences and required single assessments must be satisfied.

#### `transcript`

Represents one student's official term result for an enrollment. Contains state, version, pinned calculation-policy version, completeness status, official average, appreciation, pass/fail, rank, class size and finalized snapshot metadata.

Allowed state flow:

```text
DRAFT -> READY_FOR_REVIEW -> FINALIZED
                             |
                             v
                          REOPENED
                             |
                             +-> READY_FOR_REVIEW -> FINALIZED
```

`DRAFT` may be incomplete. `READY_FOR_REVIEW` contains a complete calculation candidate. `FINALIZED` is immutable. `REOPENED` requires a SchoolMaster, reason, time and audit event.

#### `transcript_line`

Stores one applicable class-subject line for a transcript: subject identity/label snapshot, coefficient, official subject result, weighted value, validation source and inclusion status. It is the Version 1 official subject result record, computed from validated assessment results by the pinned policy version.

The combination of transcript and class-subject is unique. A student cannot have two official values for the same class-subject/term transcript.

#### Supporting metadata

Import jobs, backup manifests and generated-document records may use supporting tables when required for idempotency, provenance and verification. Their lifecycle and retention must be documented before introduction.

## 12. Academic calculation policy

The rules in this section are the deterministic calculation core. Rounding is academic policy: Version 1 supports `HALF_UP` and `TRUNCATE`, applied at explicitly defined boundaries according to the pinned policy. Real Chadian bulletins demonstrate intermediate truncation, so intermediate values follow the configured precision/rounding mode - never an unstated universal default. All official values use fixed-point integer hundredths and never unbounded binary floating point.

### 12.1 Policy resolution and calculation graph

- A grading policy is resolved for a student/subject/term scope as: school default -> level -> level + subject. No valid published policy means grade entry and official calculation are blocked for that scope, with an actionable French message - never a silently assumed default.
- A policy's calculation graph is validated at publication: exactly one official subject result exists, every input source exists, no circular dependency exists, weights are valid and normalize correctly, all dependency paths are calculable, and scales are compatible.
- A policy version used by assessment instances or grades is immutable. Mid-term policy changes never retroactively alter a workflow already pinned to an earlier version.

### 12.2 Input parsing and result states

- Accept decimal comma or period; trim harmless surrounding whitespace; reject ambiguous or malformed formats rather than guessing.
- A supplied grade must be from `0.00` through the policy's configured scale maximum, inclusive (the `/20` secondary template is a starting point, never a universal assumption; persistence keeps a physical upper CHECK bound, the effective maximum comes from the configured scale).
- Accept at most the configured decimal places; any normalization policy beyond that requires an ADR.
- Each student assessment result carries an explicit state: `GRADED`, `MISSING`, `ABSENT`, `EXCUSED` or `NOT_APPLICABLE`. Empty input is `MISSING`, never `GRADED 0.00`.
- A Version 1 coefficient is a positive whole number, represented internally at the same exact hundredths scale.
- The effect of `ABSENT`/`EXCUSED` on averages is not invented here: it requires an explicit approved domain decision before calculation semantics are implemented.

### 12.3 Derived and subject results

For each assessment instance group, the policy computes derived results from the student's graded instances:

- `Évaluation` = `MEAN` of all applicable `GRADED` instances of its source assessment type (e.g. the Devoirs administered), at the policy's derived precision/rounding.
- Exactly one official subject result per policy combines its weighted inputs, e.g. `Évaluation 50% + Composition 50%` or `Note finale 100%`.
- Derived and subject results are computed by shared pure domain functions; UI previews and the authoritative backend call the same logic.

### 12.4 Applicability

For a student and term, include:

- every active required class-subject for the student's class enrollment;
- every optional class-subject with an active student-subject enrollment;
- per policy assignment scope (school/level/level+subject) resolved in 12.1.

Do not include inactive subjects, unrelated class assignments or optional subjects without enrollment.

### 12.5 Weighted computation

For each applicable subject:

`weighted value = official subject result × coefficient`

The unrounded overall average is:

`sum(weighted values) / sum(applicable coefficients)`

The official average is rounded at the final calculation boundary to the policy's configured precision and rounding mode (default template: half-up to two decimals). Intermediate integer/rational values remain unrounded as long as the pinned policy allows.

If the total applicable coefficient is zero, return a typed `ZERO_TOTAL_COEFFICIENT` domain error. Never generate `NaN`, infinity or an arbitrary zero average.

### 12.6 Missing values and completeness

- Missing is a first-class state and never becomes `0.00` automatically.
- Submission completeness is policy-aware: minimum assessment occurrences and required single assessments must be satisfied, and every applicable student's required result resolved.
- Provisional previews may show partial calculations only when clearly labeled incomplete and non-official.
- A transcript cannot become `READY_FOR_REVIEW` or `FINALIZED` if an applicable required value is missing.
- A transcript cannot be finalized while any relevant grade submission is not validated.
- `ABSENT`/`EXCUSED` handling is defined only through an approved domain decision or ADR.

### 12.7 Pass/fail and appreciation

Pass/fail uses the policy's configured pass threshold (for the `/20` template, an official average of `10.00` or greater passes and `9.99` fails).

Appreciation is school configuration, not a universal constant: the school defines bands, thresholds and labels through an appreciation scale, which is versioned once used by official records. A Chadian template seeds the common bands below as an editable starting point, never an implicit default:

|     Average | Appreciation |
| ----------: | ------------ |
| 18.00–20.00 | Excellent    |
| 16.00–17.99 | Très Bien    |
| 14.00–15.99 | Bien         |
| 12.00–13.99 | Assez Bien   |
| 10.00–11.99 | Passable     |
|   8.00–9.99 | Insuffisant  |
|   6.00–7.99 | Faible       |
|   0.00–5.99 | Très Faible  |

Appreciation stays distinct from Mention/admission/promotion until explicitly designed. Labels are resolved from the pinned appreciation scale/version and are used consistently by UI, services, tests, exports and PDFs.

### 12.8 Ranking

Ranking uses competition ranking based on the persisted official average:

- equal averages receive the same rank;
- the next rank skips by the number of tied students (`1, 1, 3`);
- only complete, eligible students in the same classroom and term are ranked;
- class size stored on a finalized transcript is the eligible ranked population at finalization;
- a stable secondary display order such as student code may order ties but never changes their equal rank.

The domain engine returns an explicit result for an empty eligible class. It never divides by zero or fabricates ranks.

### 12.9 Canonical fixtures

Automated tests must cover at least:

`0`, `5.99`, `6`, `7.99`, `8`, `9.99`, `10`, `11.99`, `12`, `13.99`, `14`, `15.99`, `16`, `17.99`, `18`, `20` (against the configured scale), decimal comma input, missing/absent/excused/not-applicable states, zero coefficients, an empty class, duplicate names, optional subjects, tied averages, truncation vs half-up boundaries, and policy-resolution scopes (school/level/level+subject).

## 13. Grade-entry workflow

1. The SchoolMaster configures the academic structure and publishes a grading policy (assessment types, derived results, subject result, appreciation) covering the relevant scope. Grade entry stays blocked until a valid published policy resolves.
2. The assigned Teacher opens a term/class-subject grid generated from the resolved policy and its actual assessment instances (e.g. Devoir 1, Devoir 2, Composition - one editable column per instance, read-only derived columns).
3. The service returns only applicable enrolled students for the authenticated school and assignment.
4. The Teacher enters grades per instance. Each confirmed save is durably committed with optimistic concurrency.
5. Draft state survives navigation and application restart.
6. Client and server show precise row-level errors without discarding valid draft entries.
7. Submission is blocked until policy-aware completeness is satisfied: minimum assessment occurrences, required single assessments, and every applicable student's required result resolved - or an approved policy explicitly says otherwise.
8. Submission locks Teacher editing and creates an audit event.
9. The SchoolMaster validates the complete set or returns it with a reason.
10. Validation makes the assessment results eligible for official subject-result computation.
11. Reopening requires SchoolMaster authorization, a reason and audit metadata.

Autosave must not create silent loss, duplicate writes or unclear state. The UI distinguishes unsaved, saving, saved, offline/local and failed states in French.

## 14. Transcript and bulletin workflow

1. The system builds a draft from the student's applicable subjects and validated assessment results under the pinned policy version.
2. Completeness and coefficient checks run through the canonical domain engine.
3. The engine computes derived results and the official subject result per the pinned policy, then subject weighted values, official average, pass/fail and appreciation.
4. Eligible classmates are ranked using the same persisted calculation policy.
5. The SchoolMaster reviews a provisional, visibly non-official preview.
6. Finalization runs in a transaction, verifies current versions and stores immutable input/output snapshots.
7. The PDF renderer consumes only the finalized snapshot.
8. Repeated PDF generation produces the same academic values and identity information.

An official bulletin includes at minimum:

- school identity and logo if configured;
- academic year and term;
- student name and stable code;
- classroom and level;
- subject labels, results and coefficients;
- official overall average;
- appreciation and pass/fail;
- rank and eligible class size;
- finalization/version metadata appropriate for human verification;
- printed signature/name lines approved by the school.

Version 1 does not claim cryptographic authenticity. If a finalized transcript is reopened, the prior version remains traceable and the replacement receives a new version/finalization event.

## 15. Authentication and session policy

### 15.1 Account security

- Passwords are hashed with bcrypt cost 12 or higher.
- Login returns a short-lived access token and a rotating refresh session.
- Web refresh material uses a secure, appropriately scoped `httpOnly` cookie.
- Tokens are never stored in `localStorage`.
- Refresh token hashes, not raw refresh tokens, are persisted.
- Logout revokes the active refresh session.
- Reuse of a rotated token invalidates the related session family.
- Five failed login attempts lock the account for 15 minutes.
- Login and refresh endpoints are rate-limited.

### 15.2 Local offline sign-in

Previously provisioned active users can authenticate against local credentials without internet. Account changes are authoritative within the local installation in Version 1.

### 15.3 Installation/sidecar protection

Loopback is not automatically trusted. The Tauri frontend and sidecar exchange an installation-scoped secret or equivalent authenticated bootstrap material. The design must mitigate unrelated local webpages/processes calling privileged routes and must document CORS/origin and port-discovery handling.

## 16. Tenant isolation and privacy

`school_id` is a mandatory boundary, not an optional query filter.

- Trusted tenant context comes from the installation/session, never client-supplied school selection.
- All tenant-owned queries, aggregates, exports, audit events and file paths are scoped.
- Tenant-local unique constraints include `school_id`.
- Two-school integration fixtures verify isolation even though one installation normally serves one school.
- Version 1 has no cross-tenant administrator.

Collect only data the school needs for the approved workflows. Do not put full personal records in logs, analytics, test artifacts or screenshots. Exported spreadsheets, PDFs, the SQLite database and backup archives are sensitive records and require tenant-scoped access.

## 17. Audit policy

Audit records are append-only and capture:

- school and actor;
- action and target;
- UTC timestamp;
- correlation/request ID where applicable;
- safe before/after metadata or reason;
- result/failure classification when useful.

Mandatory audit events include:

- account creation, role/status change and password reset;
- repeated/locked authentication events without logging credentials;
- academic structure changes that affect official computation;
- imports and exports;
- grade submission, return, validation and reopening;
- transcript finalization and reopening;
- backup creation, validation and restore.

Audit metadata must not contain passwords, access/refresh tokens, installation secrets or unnecessary full PII.

## 18. API contract

### 18.1 General rules

- Validate path parameters, query parameters, headers and bodies at the boundary.
- Use stable machine-readable error codes.
- Return localized user-safe messages.
- Never expose stack traces, database errors, password hashes, tokens, secrets or internal file paths.
- Paginate unbounded collections.
- Enforce maximum import, export and bulk-operation sizes.
- Bulk operations declare atomic or partial-success semantics.
- Idempotent commands use a caller/request identifier where retry can duplicate a durable action.

### 18.2 Success envelope

```json
{
  "success": true,
  "data": {},
  "message": "Opération réussie",
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150
  }
}
```

Omit `pagination` when it is not applicable.

### 18.3 Error envelope

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Le prénom est requis",
    "fields": {
      "first_name": "Ce champ est requis"
    }
  }
}
```

### 18.4 Required error categories

At minimum, contracts distinguish validation, authentication, authorization, not found, conflict/version mismatch, invalid transition, incomplete transcript, zero coefficient, import failure, backup incompatibility and internal failure.

## 19. Import and export

### 19.1 Import state machine

```text
SELECTED -> PARSED -> PREVIEWED -> VALIDATED -> CONFIRMED -> COMPLETED
                \-> REJECTED
```

No durable school record is written before confirmation.

Import requirements:

- accept only documented templates/formats for students, teachers, subjects, classrooms, class-subjects, coefficients and assignments;
- validate extension, MIME type, content structure, file size and row count;
- show normalized preview before commit;
- identify sheet/row/field failures in French;
- define duplicate handling using stable codes and other approved identifiers, never names alone;
- preserve valid preview data while the user corrects errors where feasible;
- make confirmation idempotent;
- use a full transaction or documented safe chunks with an explicit partial-success report;
- record an audit event and result summary.

### 19.2 Export requirements

- scope every export to the authenticated school and permission;
- include stable identifiers needed for safe re-import where appropriate;
- escape untrusted cells that begin with spreadsheet formula-control characters;
- bound memory use for large exports;
- record sensitive exports in audit history;
- use French labels by default and explicit date/decimal formats.

## 20. Backup and restore

### 20.1 Backup format

A backup is a versioned tenant-scoped archive containing:

- a transactionally consistent database snapshot;
- a manifest with product/schema version, school identity, creation time and file inventory;
- required tenant-owned referenced assets;
- cryptographic integrity hashes for archive members.

The archive format and any optional encryption policy are captured in an ADR before release.

### 20.2 Backup creation

- Use SQLite's supported online backup/snapshot mechanism rather than copying a live file unsafely.
- Write to a temporary path, verify integrity, then move atomically to the final path.
- Never report success until verification finishes.
- Give the operator a clear destination and safe handling guidance.

### 20.3 Restore flow

```text
SELECT -> INSPECT -> VERIFY -> COMPATIBILITY CHECK -> SAFETY BACKUP
  -> RESTORE TO STAGING -> VERIFY -> ATOMIC ACTIVATE -> RESTART/SMOKE TEST
```

Restore requirements:

- require SchoolMaster authorization and explicit French confirmation;
- reject corrupt, incomplete, wrong-school or unsupported-future backups safely;
- never modify the live database before validation;
- preserve a recovery copy of current data;
- never leave a partially activated database;
- record the operation after successful activation;
- provide a documented recovery path if application restart fails.

Version 1 release evidence includes restoring a realistic non-empty backup on another supported Windows machine and verifying representative students, assignments, results, transcripts and audit records.

## 21. Localization, UX and accessibility

### 21.1 Localization

- French is the default and must be complete.
- Arabic and English are supported locales but may follow the roadmap's delivery sequencing.
- All UI, validation, empty/error/loading states, accessibility labels, desktop messages and PDF strings use i18n keys.
- Arabic supports right-to-left layout without component-specific directional hacks.
- Dates, decimal commas, names and academic-year labels are locale-aware.

### 21.2 Grade-entry usability

- Optimize the grid for keyboard use on 1366×768 displays.
- Tab and Enter movement is predictable.
- Student identity remains visible while entering grades.
- Missing, invalid, unsaved, saving, saved, submitted and locked states are distinct in text and appearance.
- Navigation and restart do not discard confirmed work.
- Recovery messages explain what was restored.

### 21.3 Accessibility

- Use semantic HTML and native controls where possible.
- Every input has a programmatically associated label.
- Focus is visible and logical.
- All workflows are keyboard operable.
- Color is never the only indicator of result, failure, validation or state.
- Contrast meets WCAG AA for ordinary interface content.
- Dialogs manage focus and destructive operations explain consequences.

## 22. Reliability and performance budgets

Target environment: supported Windows 10/11, Intel Core i3-class CPU, 4 GB RAM, HDD storage and 1366×768 display.

| Budget                               |                            Version 1 target |
| ------------------------------------ | ------------------------------------------: |
| Cold desktop startup to usable login |                                 ≤ 8 seconds |
| Ordinary UI acknowledgement          |     ≤ 300 ms excluding deliberate bulk work |
| Grade-entry class size               |              60 students without typing lag |
| Student import preview               |        1,000 rows without memory exhaustion |
| Finalized bulletin batch             | 60 PDFs within 2 minutes on target hardware |
| Offline startup                      |   100% of core workflows after installation |
| Confirmed save durability            |  Survives restart and defined failure tests |

Measure using reproducible fixtures and document the hardware. Avoid N+1 queries, unbounded collections, synchronous bulk work on the UI thread, repeated PDF calculations and full-table reloads after a row update.

## 23. Testing strategy

### 23.1 Unit tests

Cover parsing, fixed-point arithmetic, rounding, appreciation bands, pass/fail, applicability, ranking, transitions, permission decisions, stable-code validation and safe export-cell encoding.

### 23.2 Integration tests

Cover SQLite repositories, transactions, optimistic concurrency, tenant isolation, auth rotation/logout/lockout, enrollment invariants, grade workflow, transcript finalization, imports, migrations, backup and restore.

### 23.3 Component tests

Cover localized labels, keyboard entry, row-level validation, persistence indicators, recovery, loading/empty/error states, focus and accessibility.

### 23.4 End-to-end tests

Cover:

1. First installation and school setup.
2. Account creation and offline restart/sign-in.
3. Student/class/assignment setup.
4. Spreadsheet preview and confirmed import.
5. Teacher entry, restart recovery and submission.
6. SchoolMaster return/validation/reopening.
7. Complete transcript computation, ties and finalization.
8. Repeatable PDF generation.
9. Backup, clean-machine restore and smoke verification.

### 23.5 Security and failure tests

Cover same-school unauthorized access, cross-school isolation, loopback request protection, token reuse, repeated idempotent commands, interrupted transactions, stale versions, malformed uploads, formula injection, corrupt backups, disk/write failures and crash/restart around grade saves.

## 24. Version 2 architecture direction

Version 2 begins only after Version 1 operates through a real academic term and evidence supports expansion.

Dependency order:

1. Domain and schema corrections discovered by the pilot.
2. PostgreSQL repository adapter and cloud operational foundation.
3. Durable synchronization protocol, idempotency and observability.
4. Conflict handling proven specifically for grades and finalized records.
5. Only then, remote web access and stakeholder portals.

Future sync must include:

- durable local mutation identifiers;
- per-record version and deletion/tombstone semantics;
- idempotent push and pull;
- retry/backoff and restart-safe queues;
- explicit conflict detection and durable conflict logs;
- field/module-specific rules for critical academic records;
- honest visible sync state;
- no blocking of the local core workflow.

Last-write-wins is not automatically acceptable for validated grades, finalized transcripts, identities or future financial records. Those policies require dedicated ADRs and conflict tests.

Candidate future modules-finance, attendance, portals, communications, timetable, payroll, mobile and cryptographic signing-are prioritized only from measured school demand, willingness to pay and support cost.

## 25. Required ADRs

At minimum, create or accept ADRs before their related implementation is considered stable:

1. Tauri/Fastify sidecar packaging and clean-machine Windows strategy.
2. Loopback authentication, port discovery and origin protection.
3. SQLite backup archive, integrity and optional encryption format.
4. Official fixed-point intermediate arithmetic and round-half-up implementation.
5. Transcript snapshot/versioning and reopening semantics.
6. Import duplicate and partial-success policy.
7. Windows installer signing, WebView2 and update policy.
8. Version 2 cloud repository and sync protocol, when that work begins.

An ADR records context, decision, alternatives, consequences and migration/rollback implications. It does not merely restate the selected library.

## 26. Version 1 acceptance baseline

Version 1 is releasable only when:

- one pilot school can complete setup without developer database edits;
- Teacher and SchoolMaster permissions are enforced at UI and service layers;
- the full grade-to-finalized-bulletin path works offline;
- canonical calculations and tie ranking pass shared fixtures;
- PDFs reproduce persisted finalized snapshots;
- 1,000-row import preview and 60-student grade/PDF workflows meet target-machine budgets;
- confirmed grade edits survive navigation, restart and defined failure tests;
- a non-empty backup restores successfully on a second supported Windows machine;
- installation and offline startup pass the Windows target matrix;
- two-school fixtures demonstrate tenant isolation;
- audit history covers all mandatory critical actions;
- French content is complete and the core workflow is keyboard-accessible;
- no known critical data-loss, wrong-calculation, authorization, privacy or startup defect remains;
- the product completes a monitored school-term pilot before being described as validated.

## 27. Governing principle

When speed, scope and trust conflict, protect the school record. The system is successful only when staff can enter results, print a bulletin, recover the database after failure and confidently explain why every official value is correct.
