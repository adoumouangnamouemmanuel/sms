# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- **Monorepo Setup**: Initialized `pnpm` workspaces with root configuration (`pnpm-workspace.yaml`, `package.json`).
- **Tech Stack locked**: Node.js/Fastify, Next.js, React Native (Expo), Tauri, Drizzle ORM, SQLite/PostgreSQL.
- **App Scaffolding**: Generated base structures for `@edutrack/web`, `@edutrack/mobile`, `@edutrack/desktop`, and `@edutrack/api`.
- **Database Setup**: Initialized `@edutrack/db` with Drizzle and base schemas (`school`, `academic_year`, `user`).
- **Tooling**: Added base `tsconfig`, `.prettierrc`, and `.gitignore`.
- **Documentation**: Added `CONTRIBUTING.md`, merged UML into `sms.md`, and recorded Tech Stack ADR (`ADR-001`).
- **Docker**: Local PostgreSQL testing configured to run on port `5234`.