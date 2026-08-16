# ADR-011: Phase 3 gate strategy - load tests inside the API test suite

- **Status**: Accepted
- **Date**: 2026-08-15
- **Context**: Phase 3 §9.5 (gate) requires proof that 1,000 representative
  student rows can be imported without duplicate creation or partial
  corruption, that re-confirming the same import is a clearly reported no-op,
  and that duplicate names remain distinguishable by code. The team needed a
  repeatable, fast, dependency-free way to prove this on every commit rather
  than a one-off script.

## Decision

Add gate acceptance tests as a dedicated Vitest suite
(`apps/api/src/test/imports.gate.test.ts`) that boots the real Fastify server
against an in-memory SQLite database and drives the actual HTTP endpoints
(multipart preview + confirm). The 1,000-row fixture is generated
deterministically (seeded PRNG, fixed explicit codes, fixed invalid rows) so
every run is byte-identical and the assertions are exact. No external load
tooling (k6, artillery, locust) is introduced for this gate.

## Consequences

- The gate evidence runs in CI as part of `pnpm test:unit` - no separate
  harness to maintain or version-skew to chase.
- The full 1,000-row round-trip executes in ~1 second on a developer machine,
  fast enough to keep the unit gate responsive.
- Deterministic fixtures mean failures are reproducible; the assertions check
  invariants (code uniqueness, no empty names, list-total agreement) rather
  than fuzzy performance thresholds.
- The remaining 9.5 criterion - a non-developer finds, edits and archives a
  record - is inherently manual and is documented as a walkthrough in the
  roadmap implementation note rather than automated.
