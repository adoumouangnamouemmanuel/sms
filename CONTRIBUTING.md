# Contributing to EduTrack Africa

## Naming Conventions
- Variables & Functions: `camelCase`
- Classes & Components: `PascalCase`
- Database Columns: `snake_case`

## File Structure
- One component per file.
- One service per file.

## Commit Messages
Use conventional commits:
- `feat:` New features
- `fix:` Bug fixes
- `chore:` Maintenance
- `docs:` Documentation updates
- `test:` Tests

## Branching
- `main`: Production ready
- `develop`: Integration
- `feature/*`: New features
- `fix/*`: Bug fixes

## Development Rules
- **API Endpoints**: All API endpoints must have input validation. No raw DB queries in route handlers.
- **Financial & Grade Amounts**: All amounts (fees, salaries, grades) must be stored as integers in cents/hundredths to avoid floating point errors. The display layer will handle formatting.
- **Language**: All user-facing strings must go through i18n keys. No hardcoded French strings in components.
