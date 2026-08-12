# apps/web

This package is the shared EduTrack Africa product UI for the browser and Tauri WebView.

- Use Vite React. Next.js is intentionally out of scope for Version 1.
- Keep all visible strings behind i18n keys, with French complete first.
- Do not import API, desktop, or database adapter code into React components.
- Keep the first screen useful as an application shell, not as a marketing landing page.
