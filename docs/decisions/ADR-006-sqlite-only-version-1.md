# ADR-006: SQLite-Only Version 1

## Status

Accepted

## Context

EduTrack Africa Version 1 is a local Windows product for schools with unreliable or absent internet. The product specification excludes cloud hosting, cloud synchronization, multi-device web access and mobile applications from Version 1.

PostgreSQL remains a possible Version 2 cloud/sync store, but adding it to the active Version 1 runtime would increase complexity before the offline workflow is proven.

## Decision

Use SQLite through `better-sqlite3` as the only Version 1 system of record.

Version 1 database work must:

- read and write local SQLite first;
- confirm UI actions only after local transactions commit;
- avoid PostgreSQL runtime configuration, migrations, repositories and seed scripts in the active Version 1 code path;
- retain tenant boundary fields such as `school_id` where the schema needs them for correctness and future migration safety.

## Consequences

This keeps the pilot product deployable without internet, Docker or a managed database. PostgreSQL, Supabase, cloud APIs, synchronization queues and conflict resolution require separate Version 2 evidence and ADR approval before entering the active runtime.
