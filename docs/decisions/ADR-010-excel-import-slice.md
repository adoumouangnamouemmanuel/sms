# ADR-010: Excel import slice - in-memory preview, identifier idempotency, formula-safe exports

- **Status:** Accepted
- **Date:** 2026-08-15 (Phase 3.4)

## Context

Roadmap §9.4 requires a French student/teacher Excel import following
`upload -> parse -> preview -> validate -> confirm -> transact -> report`,
with three hard rules: nothing persists during preview, exports must be safe
from spreadsheet formula injection, and confirmed imports must be idempotent
through an import identifier. Codes - not names - are the identity.

## Decisions

### DP-9.4.1 - Preview state lives in memory, never in SQLite

Parsed previews are held in an in-memory store on the sidecar keyed by a random
`importId`, scoped to the school that created them, expiring after 30 minutes.
The confirm step reads from that store and only then writes to the database -
inside one transaction. Consequence: restarting the sidecar (or the TTL
expiring) invalidates the preview, and the UI tells the user to re-analyze.

### DP-9.4.2 - Idempotency via a per-school import identifier

Confirmed imports are recorded in a new `import_batch` table (migration 0006)
with a unique `(school_id, import_identifier)` index. Confirming the same
identifier twice returns `alreadyConfirmed: true` and imports nothing. The
identifier is chosen by the school master (e.g. `rentree-2026-09-01`), which
makes re-runs after network hiccups safe and gives each batch a human-readable
handle for the audit log (`IMPORT_CONFIRMED`).

### DP-9.4.3 - Identity is the code, never the name

Rows are validated and deduplicated on the normalized code (in-file duplicates
are flagged at preview; codes already present in the school are skipped at
confirm). Names are never used for matching - merging on name alone is
explicitly refused by the roadmap.

### DP-9.4.4 - Formula injection is neutralized on export

The rejected-rows CSV prefixes any cell starting with `=`, `+`, `-`, `@`, tab
or carriage return with a single quote, and quotes/escapes CSV delimiters, so
re-opening the file in Excel treats the content as text. (Input xlsx files are
parsed as values, so cell contents never execute on import.)

### DP-9.4.5 - Libraries: SheetJS `xlsx` + `@fastify/multipart` v8

`xlsx` (SheetJS 0.20.x, official distribution) does parsing, template
generation and CSV-safe reading in one offline-capable package; it is bundled
into the sidecar by esbuild alongside everything except `bcrypt` and
`better-sqlite3`. `@fastify/multipart` v8 is pinned to match the Fastify 4
runtime (v9 requires Fastify 5) and is registered in the imports routes'
encapsulated scope, so only those routes accept uploads (10 MB cap, one file,
no fields).

## Consequences

- A lost preview (TTL expiry, sidecar restart) requires re-uploading the file;
  acceptable for a local single-operator tool and keeps the preview promise
  simple.
- Generated codes follow the existing `{school}-{year}-{NNI}` fallback from
  `people.codes.ts`, so the NNI confirmation (pending before 9.4) still changes
  in exactly one place.
- `import_batch` rows accumulate per import; they are the durable record for
  the audit trail and for future reporting (roadmap §16 candidate module).
