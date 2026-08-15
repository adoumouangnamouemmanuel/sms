# ADR-009: Teacher login accounts are generated once and managed independently of the record

- **Status:** Accepted
- **Date:** 2026-08-15 (Phase 3.3)

## Context

Roadmap §9.3 requires that a Teacher login be created and deactivated
"independently of the teacher record". Two design questions had to be settled:

1. **Who chooses the credentials?** The school master could type a username and
   password when creating the account, or the system could generate them.
2. **Where does the account live relative to the record?** The `user` row (with
   its `role` `TEACHER`) is linked to the `teacher` row via `user_id`; a teacher
   can exist with no login, or keep its record while the account is disabled.

## Decision

### DP2 — generated credentials, shown exactly once

`POST /teachers/:id/login` generates a username and a strong initial password
server-side. The response (`teacherLoginCreatedResponseSchema`) contains
`{ userId, username, initialPassword }` and is the **only** time the password is
ever returned; the API never stores or returns the plaintext again. The UI shows
them in a "credentials once" modal with a copy button.

Rationale:

- The target deployment is an offline school with a non-technical operator;
  having to invent and remember a strong password per teacher is friction and
  invites weak passwords.
- Generating avoids the username-taken guessing loop and keeps the login
  creation to a single action instead of a two-field form.
- Password hashes follow the existing bcrypt (cost ≥ 12) policy from Phase 2.

### Independent lifecycle

- `POST /teachers/:id/login` requires an **active** teacher record.
- `POST /teachers/:id/login/deactivate` requires a reason (same rule as
  archiving a record) and only flips the `user` account flag — the teacher
  record keeps its status.
- `POST /teachers/:id/login/reactivate` re-enables the account.
- Archiving a teacher record does not cascade to the account, and vice versa;
  the profile shows both statuses side by side.

### DP1 — teachers are their own school module

`TEACHERS` joins `STUDENTS` in `IMPLEMENTED_SCHOOL_MODULES` and the
`school_module_config` CHECK (migration `0005`), with the same backfill for
existing schools. This keeps module gating uniform across Phase 3 slices.

## Consequences

- The credentials-once contract means a lost initial password cannot be
  recovered from the app; the school master must deactivate and re-create the
  login (or use the Phase 2 password-reset flow for the affected user).
- `people.codes.ts` centralizes the shared `{school}-{year}-{NNI}` generator for
  both students and teachers.
- Future assignment/grade tables (roadmap §9.3 note) will extend the
  archive-blocking rule for teachers with historical records.
