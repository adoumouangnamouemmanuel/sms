# EduTrack Africa Database Schema

SQLite is the Version 1 system of record. PostgreSQL, cloud sync and remote web access remain out of scope until a later ADR approves them.

## Conventions

- Primary keys are UUID text values, except explicitly keyed metadata tables such as `schema_metadata`.
- Database columns use `snake_case`; TypeScript schema properties use `camelCase`.
- Tenant-owned tables contain a non-null `school_id` foreign key.
- Mutable records carry `created_at`, `updated_at`, `record_version` and `deleted_at`.
- Audit records are append-only and expose insert-only repository primitives.
- Tenant-local uniqueness includes `school_id`.

## Phase 1.3 and Phase 2.2 Tables

### `school`

Stores school identity and local installation configuration.

Key columns: `id`, `code`, `name`, `short_name`, `city`, `country`, `locale`, `timezone`, `currency`, `setup_status`, lifecycle metadata.

Indexes:

- `school_code_unique`

### `academic_year`

Tracks academic years for one school.

Key columns: `id`, `school_id`, `label`, `start_date`, `end_date`, `is_current`, lifecycle metadata.

Indexes:

- `academic_year_school_id_idx`
- `academic_year_school_current_unique`
- `academic_year_school_label_unique`

### `term`

Tracks the trimester or semester periods inside the current academic year.

Key columns: `id`, `school_id`, `academic_year_id`, `label`, `term_number`, `start_date`, `end_date`, `is_current`, lifecycle metadata.

Indexes and constraints:

- `term_school_id_idx`
- `term_academic_year_id_idx`
- `term_academic_year_current_unique`
- `term_academic_year_label_unique`
- `term_academic_year_number_unique`
- `term_number_check`
- `term_date_range_check`

### `class_level`

Stores tenant-local curriculum levels such as `6E`, `3E` or `TLE`.

Key columns: `id`, `school_id`, `code`, `name`, `display_order`, `is_exam_year`, `is_active`, lifecycle metadata.

Indexes and constraints:

- `class_level_school_id_idx`
- `class_level_school_code_unique`
- `class_level_school_name_unique`
- `class_level_school_order_unique`
- `class_level_display_order_check`

### `school_module_config`

Controls which implemented modules appear for a school. Phase 2.2 enables only setup and academic-structure navigation; future modules stay absent until implemented.

Key columns: `id`, `school_id`, `module_name`, `is_enabled`, `config_json`, lifecycle metadata.

Indexes and constraints:

- `school_module_config_school_id_idx`
- `school_module_config_school_module_unique`
- `school_module_config_module_name_check`

### `user`

Stores local authenticated users for Version 1 roles.

Allowed application roles: `SCHOOL_MASTER`, `TEACHER`.

Key columns: `id`, `school_id`, `username`, `password_hash`, `role`, `is_active`, `failed_login_attempts`, `locked_until`, lifecycle metadata.

Indexes:

- `user_school_id_idx`
- `user_school_id_id_unique`
- `user_school_username_unique`

### `refresh_session`

Tracks hashed rotating refresh-token sessions and session families.

Key columns: `id`, `school_id`, `user_id`, `token_hash`, `family_id`, `replaced_by_session_id`, `expires_at`, `revoked_at`, lifecycle metadata.

Indexes:

- `refresh_session_school_id_idx`
- `refresh_session_user_id_idx`
- `refresh_session_family_id_idx`
- `refresh_session_token_hash_unique`
- `refresh_session_replaced_by_idx`

### `audit_log`

Append-only tenant-scoped audit events.

Key columns: `id`, `school_id`, `actor_user_id`, `action`, `target_type`, `target_id`, `correlation_id`, `metadata_json`, `outcome`, `occurred_at`.

Indexes:

- `audit_log_school_id_idx`
- `audit_log_actor_user_id_idx`
- `audit_log_target_idx`

### `schema_metadata`

Stores local schema/seed metadata that must persist with the SQLite database. Its `key` column is a deliberate non-UUID primary-key exception because metadata records are addressed by stable names.

Key columns: `key`, `value`, `description`, `created_at`, `updated_at`, `record_version`.

## Phase 3.1 People Tables

### `student`

Stores tenant-local students. Duplicate names are valid; the student code is the durable identity and is never reused after archive.

Key columns: `id`, `school_id`, `code`, `first_name`, `last_name`, `sex`, `date_of_birth`, `place_of_birth`, `nationality`, `photo_url`, `phone`, `email`, `address`, `is_active`, lifecycle metadata.

Indexes and constraints:

- `student_school_id_idx`
- `student_school_last_name_idx`
- `student_school_code_unique` (strict: no archive reuse)
- `student_school_id_id_unique`
- `student_sex_check` (`M`, `F`, `AUTRE`)

### `teacher`

Stores tenant-local teachers with an optional same-school login link. Record status (`is_active`) is independent from the linked account status (`user.is_active`).

Key columns: `id`, `school_id`, `code`, `first_name`, `last_name`, `specialization`, `hire_date`, `phone`, `email`, `address`, `user_id`, `is_active`, lifecycle metadata.

Indexes and constraints:

- `teacher_school_id_idx`
- `teacher_school_last_name_idx`
- `teacher_school_code_unique` (strict: no archive reuse)
- `teacher_school_id_id_unique`
- composite FK `(school_id, user_id)` → `user(school_id, id)`

### `guardian`

Stores tenant-local guardians (parents or responsible adults). Guardians have no code; they are identified by UUID and linked to students through `student_guardian`.

Key columns: `id`, `school_id`, `first_name`, `last_name`, `phone`, `email`, `address`, `is_active`, lifecycle metadata.

Indexes:

- `guardian_school_id_idx`
- `guardian_school_last_name_idx`
- `guardian_school_id_id_unique`

### `student_guardian`

Links students to guardians. A guardian may link to several students (siblings) and a student to several guardians, with at most one primary contact per student. Unlinking soft-archives the row so the pair can be re-linked later.

Key columns: `id`, `school_id`, `student_id`, `guardian_id`, `relationship_type`, `is_primary`, `is_emergency`, `notes`, lifecycle metadata.

Indexes and constraints:

- `student_guardian_school_id_idx`
- `student_guardian_student_id_idx`
- `student_guardian_guardian_id_idx`
- `student_guardian_school_student_guardian_unique` (one link per pair)
- `student_guardian_student_primary_unique` (at most one primary per student)
- `student_guardian_relationship_type_check` (`PERE`, `MERE`, `TUTEUR`, `AUTRE`)
- composite FKs `(school_id, student_id)` → `student(school_id, id)` and `(school_id, guardian_id)` → `guardian(school_id, id)`

## Migrations

SQLite migration files live in `packages/db/migrations/sqlite`.

`0001_aspiring_fixer.sql` is intentionally a table-rebuild migration for existing scaffold tables because SQLite cannot safely add several non-null timestamp columns or foreign-key changes with plain `ALTER TABLE`.

`0002_glorious_lizard.sql` adds the Phase 2.2 setup tables for terms, class levels and module visibility. It is additive and safe for non-empty databases that do not already violate the single-current-year invariant.

`0003_old_sumo.sql` adds the Phase 3.1 people tables (`student`, `teacher`, `guardian`, `student_guardian`) with strict tenant-local code uniqueness and composite tenant foreign keys. It is additive and safe for non-empty databases.

`0004_students_module.sql` widens the `school_module_config.module_name` CHECK to accept `STUDENTS` (hand-written table rebuild, since drizzle-kit does not emit CHECK constraints) and backfills an enabled `STUDENTS` row for every school that lacks one, so already-setup schools surface the students module too.

`0005_teachers_module.sql` follows the same pattern for `TEACHERS` (CHECK widening + per-school backfill), so already-setup schools surface the teachers module as well. The teacher `user_id` login link keeps its `ON DELETE RESTRICT` behavior, and teacher/student/guardian list repositories accept an optional `status` filter (`active` | `archived`) so archived people stay reachable.

`0006_import_batch.sql` adds the `import_batch` table that records each confirmed Excel import (kind, import identifier, filename, row counts) with a unique `(school_id, import_identifier)` index — the backbone of import idempotency (Phase 3.4). Import previews themselves are never persisted; they live in an in-memory store on the sidecar with a 30-minute TTL.

`0009_gifted_kronos.sql` and `0010_slippery_mother_askani.sql` add the Phase 4 classes and curriculum data model (roadmap §10.1): five new tenant-scoped tables with composite `(school_id, id)` foreign keys and partial unique indexes — `subject` (school catalogue with code, localized names, category), `classroom` (cohort/section within an academic year and class level, year-local code), `class_subject` (subject/coefficient/teacher assignment per classroom, required/optional policy), `class_enrollment` (student ↔ classroom for a year with a controlled status; the partial unique index enforces at most one `ACTIVE` enrollment per student/year), and `student_subject_enrollment` (explicit links to optional class-subjects). `0010` adds the `(school_id, id)` unique index on `class_level` that SQLite requires for the composite tenant foreign keys from `classroom`. Domain CHECK constraints (subject category, coefficient ≥ 1, enrollment status, capacity ≥ 1) are enforced in both the migration and the source schema.

`0011_classes_import_kinds.sql` rebuilds `import_batch` so its `kind` CHECK accepts the three Phase 4.2/4.3 import kinds (`SUBJECTS`, `CLASSROOMS`, `CLASS_SUBJECTS`), preserving all rows and indexes — confirmed-import history stays auditable for the new templates.

`0012_classes_module.sql` registers the `CLASSES` school module (roadmap §10.2): it rebuilds `school_module_config` so the `module_name` CHECK accepts `CLASSES` and backfills an enabled `CLASSES` row for every school that lacks one, so already-setup schools surface the classes & curriculum module as well.

## Seed Policy

Foundation seed data is deterministic and idempotent. It uses synthetic demo schools only; real school or student data is forbidden in seeds and tests.

Demo credentials for the seeded schools (`NDS-DEMO`, `MND-DEMO`): school code `NDS-DEMO`, username `directeur`. The password must be provided via the `EDUTRACK_SEED_PASSWORD_HASH` environment variable during seeding as a **valid bcrypt hash with a cost factor of 12 or higher** (the app's `BCRYPT_COST`); a malformed hash or one below cost 12 fails seeding loudly rather than persisting a broken login. When the variable is unset or empty, the accounts remain locked and require administrator configuration before first login.

Run after applying the schema:

```bash
pnpm run db:seed
```
