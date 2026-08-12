# ADR-005: Fastify Sidecar

## Status

Accepted

## Context

The React UI must not write directly to SQLite or own authorization and persistence rules. Version 1 needs a local service boundary that can enforce validation, authentication, authorization, transactions and audit creation while still working entirely offline.

## Decision

Use a Fastify sidecar as the local API process for Version 1.

The sidecar:

- binds only to loopback;
- rejects non-local or unexpected origins/capabilities;
- exposes versioned HTTP routes when public compatibility begins;
- validates transport input before calling application services;
- contains no raw database queries in route handlers;
- uses safe logging defaults that redact credentials, cookies, tokens and password fields.

## Consequences

The sidecar gives the desktop product a clear service boundary and keeps official domain behavior out of React components. Packaging the sidecar as a self-contained Windows executable remains part of the Phase 1 deployment spike.
