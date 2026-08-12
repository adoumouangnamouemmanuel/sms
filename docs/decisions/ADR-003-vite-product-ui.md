# ADR-003: Vite Product UI

## Status

Accepted

## Context

EduTrack Africa Version 1 is an authenticated, offline-first desktop product. The same React interface must run in the browser during development and inside the Tauri WebView for the Windows desktop app. Version 1 does not need server rendering, static generation, SEO, or a hosted multi-device web app.

The updated product specification explicitly excludes Next.js from the Version 1 product stack.

## Decision

Use Vite with React and TypeScript for the product UI in `apps/web`.

The product UI:

- is a client-rendered React application;
- is shared by browser development and the Tauri WebView;
- keeps all visible strings behind i18n keys, with French complete first;
- depends only on approved UI, shared and domain packages;
- does not import API, desktop or database adapter code.

## Consequences

Vite keeps the desktop-focused UI small and predictable, avoids product dependency on a server-rendering framework, and gives Tauri a direct static asset build. A separate public marketing site may use another framework later if approved separately, but it is not part of Version 1.
