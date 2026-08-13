# EduTrack Africa Database Schema

SQLite is the Version 1 system of record. PostgreSQL, cloud sync and remote web access remain out of scope until a later ADR approves them.

## Conventions

- Primary keys are UUID text values, except explicitly keyed metadata tables such as `schema_metadata`.
- Database columns use `snake_case`; TypeScript schema properties use `camelCase`.
- Tenant-owned tables contain a non-null `school_id` foreign key.
- Mutable records carry `created_at`, `updated_at`, `record_version` and `deleted_at`.
- Audit records are append-only and expose insert-only repository primitives.
- Tenant-local uniqueness includes `school_id`.

## Phase 1.3 Tables

### `school`

Stores school identity and local installation configuration.

Key columns: `id`, `code`, `name`, `short_name`, `city`, `country`, `locale`, `timezone`, `currency`, `setup_status`, lifecycle metadata.

Indexes:

- `school_code_unique`

### `academic_year`

Tracks academic years for one school. This is still foundation-level; term validation is Phase 2.

Key columns: `id`, `school_id`, `label`, `start_date`, `end_date`, `is_current`, lifecycle metadata.

Indexes:

- `academic_year_school_id_idx`
- `academic_year_school_label_unique`

### `user`

Stores local authenticated users for Version 1 roles.

Allowed application roles: `SCHOOL_MASTER`, `TEACHER`.

Key columns: `id`, `school_id`, `username`, `password_hash`, `role`, `is_active`, `failed_login_attempts`, `locked_until`, lifecycle metadata.

Indexes:

- `user_school_id_idx`
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

## Migrations

SQLite migration files live in `packages/db/migrations/sqlite`.

`0001_aspiring_fixer.sql` is intentionally a table-rebuild migration for existing scaffold tables because SQLite cannot safely add several non-null timestamp columns or foreign-key changes with plain `ALTER TABLE`.

## Seed Policy

Foundation seed data is deterministic and idempotent. It uses synthetic demo schools only; real school or student data is forbidden in seeds and tests.

Run after applying the schema:

```bash
pnpm run db:seed
```
