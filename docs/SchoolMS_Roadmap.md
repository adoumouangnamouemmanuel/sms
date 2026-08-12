# 🗺️ EduTrack Africa - Development Roadmap

## From Zero to Full School Management System

### A Detailed, Phase-by-Phase Build Plan

---

## Table of Contents

1. [Guiding Philosophy](#1-guiding-philosophy)
2. [Project Timeline Summary](#2-project-timeline-summary)
3. [Team Structure Recommendation](#3-team-structure-recommendation)
4. [Phase 0 - Foundation & Setup](#phase-0--foundation--setup-weeks-1-2)
5. [Phase 1 - Core Backend & Database](#phase-1--core-backend--database-weeks-3-6)
6. [Phase 2 - Authentication & School Config](#phase-2--authentication--school-config-weeks-7-9)
7. [Phase 3 - Student & Teacher Modules](#phase-3--student--teacher-modules-weeks-10-14)
8. [Phase 4 - Class & Curriculum Management](#phase-4--class--curriculum-management-weeks-15-17)
9. [Phase 5 - Grades & Transcript Engine](#phase-5--grades--transcript-engine-weeks-18-23)
10. [Phase 6 - Finance Module](#phase-6--finance-module-weeks-24-26)
11. [Phase 7 - Timetable & Academic Calendar](#phase-7--timetable--academic-calendar-weeks-27-29)
12. [Phase 8 - Import / Export & Excel Integration](#phase-8--import--export--excel-integration-weeks-30-32)
13. [Phase 9 - Desktop App Packaging](#phase-9--desktop-app-packaging-weeks-33-35)
14. [Phase 10 - Student Portal & Resources](#phase-10--student-portal--resources-weeks-36-38)
15. [Phase 11 - Reporting & Analytics](#phase-11--reporting--analytics-weeks-39-42)
16. [Phase 12 - Digital Signatures & PDF Engine](#phase-12--digital-signatures--pdf-engine-weeks-43-45)
17. [Phase 13 - Notifications & Communication](#phase-13--notifications--communication-weeks-46-47)
18. [Phase 14 - Testing, QA & Hardening](#phase-14--testing-qa--hardening-weeks-48-51)
19. [Phase 15 - Pilot Deployment](#phase-15--pilot-deployment-weeks-52-56)
20. [Phase 16 - Scale & Multi-School](#phase-16--scale--multi-school-weeks-57-64)
21. [Milestone Checklist](#milestone-checklist)
22. [Risk Register](#risk-register)
23. [Definition of Done](#definition-of-done)

---

## 1. Guiding Philosophy

Before writing a single line of code, internalize these principles. They will save you months of rework.

**Build vertically, not horizontally.**
Do not build all database tables first, then all APIs, then all UIs. Instead, pick one feature, build it end-to-end (DB → API → UI), ship it, then move to the next. This gives you working software at every phase.

**Real users as early as possible.**
By Phase 2, a real school administrator should be able to log in and configure their school. By Phase 5, a real teacher should be able to enter grades. Early feedback from real African schools prevents you from building the wrong thing.

**Offline first, always.**
Most schools in Chad have intermittent internet. Every feature must work offline on the desktop app. Cloud sync is an enhancement, not a requirement.

**Data integrity over speed.**
A grade entered incorrectly, a transcript with a wrong average - these destroy trust. Validate everything twice: on the frontend and on the backend. Never trust the client.

**French first.**
All UI labels, error messages, PDF output, and documentation facing school staff must be in French from day one. Do not plan to "add French later." It must be the default.

---

## 2. Project Timeline Summary

```
YEAR 1 (Months 1–12)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Month  1   2   3   4   5   6   7   8   9  10  11  12
       ├───┤   ├───┤   ├───┤   ├───┤   ├───┤   ├───┤
Ph 0   ███                                              Foundation & Setup
Ph 1   ████████                                         Core Backend & DB
Ph 2       ████████                                     Auth & School Config
Ph 3           ████████████                             Students & Teachers
Ph 4                   ████████                         Classes & Curriculum
Ph 5                       ████████████████             Grades & Transcripts
Ph 6                                   ██████           Finance
Ph 7                                       ██████       Timetable

YEAR 2 (Months 13–18)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Month 13  14  15  16  17  18
      ├───┤   ├───┤   ├───┤
Ph 8  ██████                  Excel Import/Export
Ph 9      ██████              Desktop App Packaging
Ph10          ██████          Student Portal & Resources
Ph11              ██████      Reporting & Analytics
Ph12                  ████    Digital Signatures & PDF
Ph13                    ████  Notifications
Ph14  ████████████████████    Testing & QA (continuous)
Ph15                    ████  Pilot Deployment
Ph16                      ██► Scale & Multi-School (Year 3+)
```

---

## 3. Team Structure Recommendation

This roadmap assumes a small, focused team. Adjust based on your resources.

```
┌─────────────────────────────────────────────────────────────────┐
│                       Minimum Viable Team                         │
├──────────────────────┬──────────────────────────────────────────┤
│ Role                 │ Responsibility                            │
├──────────────────────┼──────────────────────────────────────────┤
│ Tech Lead / Architect│ Architecture decisions, code reviews,    │
│ (You)                │ backend lead, database design            │
├──────────────────────┼──────────────────────────────────────────┤
│ Frontend Developer   │ React UI, desktop app shell (Tauri),     │
│                      │ forms, PDF viewer, responsive design     │
├──────────────────────┼──────────────────────────────────────────┤
│ Backend Developer    │ REST API, business logic, ORM queries,   │
│                      │ file handling, sync engine               │
├──────────────────────┼──────────────────────────────────────────┤
│ School Liaison       │ NOT a developer - a trusted teacher or   │
│ (Part-time advisor)  │ school admin in Chad who gives feedback, │
│                      │ tests the app, and reports real needs    │
└──────────────────────┴──────────────────────────────────────────┘

If working solo: Focus on one layer at a time. Use Cursor AI / GitHub Copilot
to accelerate boilerplate. Always prioritize backend correctness over UI beauty.
```

---

## Phase 0 - Foundation & Setup

### Weeks 1–2 | Milestone: Dev environment ready, project scaffolded

This phase has zero user-facing output. It is invisible but critical. Rushing it causes pain for the next 18 months.

---

### 0.1 - Choose & Lock Your Tech Stack

Do not change the stack mid-project. Make decisions now and commit.

**Locked Tech Stack (Phase 0.1 Complete):**

- [x] **Frontend framework**: Next.js + TypeScript.
- [x] **Desktop shell**: Tauri (Rust-based).
- [x] **Mobile app**: React Native.
- [x] **Styling**: Tailwind CSS.
- [x] **Backend**: Node.js + Fastify (TypeScript) with `@fastify/swagger` for auto-docs.
- [x] **Database (local)**: SQLite via `better-sqlite3`.
- [x] **Database (cloud & testing)**: PostgreSQL. (Docker to be used for local DB testing only, exposed on port 5234).
- [x] **ORM**: Drizzle ORM.
- [x] **PDF generation**: `@react-pdf/renderer`.
- [x] **Excel handling**: `SheetJS (xlsx)`.
- [x] **Auth**: JWT with `jose` library (Node). Self-hosted.
- [x] **i18n**: `i18next` with `react-i18next`. French as default locale.
- [x] **Testing**: Vitest + Testing Library, Playwright.

---

### 0.2 - Set Up Version Control & Project Structure

```bash
# Create the monorepo
mkdir edutrack-africa
cd edutrack-africa
git init

# Monorepo structure
edutrack-africa/
├── apps/
│   ├── desktop/          # Tauri desktop application
│   ├── web/              # React web app (same codebase as desktop frontend)
│   └── api/              # Backend REST API
├── packages/
│   ├── shared/           # Shared types, constants, validation schemas
│   ├── db/               # Database schema, migrations, seed data
│   └── ui/               # Shared UI components (design system)
├── docs/                 # UML design, roadmap, decisions
├── scripts/              # Dev scripts, seed scripts, build scripts
├── .github/
│   └── workflows/        # CI/CD pipelines
└── package.json          # Workspace root (pnpm workspaces)
```

**Tools to install:**

- [ ] pnpm (package manager - faster than npm, better for monorepos)
- [ ] Node.js 20 LTS
- [ ] Rust (required for Tauri)
- [ ] Tauri CLI
- [ ] PostgreSQL (local dev instance)
- [ ] TablePlus or DBeaver (database GUI for development)

---

### 0.3 - Define Coding Standards

Write a `CONTRIBUTING.md` with:

- [ ] Naming conventions: `camelCase` for variables, `PascalCase` for classes/components, `snake_case` for database columns.
- [ ] File structure: one component per file, one service per file.
- [ ] Commit message format: `feat:`, `fix:`, `chore:`, `docs:`, `test:` prefixes.
- [ ] Branch strategy: `main` (production), `develop` (integration), `feature/xxx` (features), `fix/xxx` (bug fixes).
- [ ] Required: all API endpoints must have input validation. No raw DB queries in route handlers.
- [ ] Required: all amounts (fees, salaries, grades) stored as integers in cents/hundredths to avoid floating point errors. Display layer handles formatting.
- [ ] Language: all user-facing strings go through i18n keys. No hardcoded French strings in components.

---

### 0.4 - Set Up Development Tooling

- [ ] ESLint + Prettier (code quality and formatting)
- [ ] Husky + lint-staged (pre-commit hooks - block bad code from entering the repo)
- [ ] GitHub Actions workflow for CI: run tests on every push to `develop`
- [ ] Environment variables: `.env.example` file with all required variables documented
- [ ] Create `docs/decisions/` folder - write an ADR (Architecture Decision Record) for every major choice. Example: `ADR-001-why-tauri-over-electron.md`

---

### 0.5 - Set Up the Database Project

- [ ] Initialize Drizzle ORM in `packages/db/`
- [ ] Write the migration for the first 3 tables: `school`, `academic_year`, `user`
- [ ] Set up `seed.ts` script that creates a demo school with test data
- [ ] Confirm migrations run on both SQLite (local/desktop) and PostgreSQL (cloud)
- [ ] Document all table schemas in `docs/database/`

**Deliverable at end of Phase 0:**
A developer can clone the repo, run `pnpm install && pnpm db:migrate && pnpm db:seed` and have a working local database. They can run `pnpm dev` and see a "Hello EduTrack" screen on both the web app and the desktop app.

---

## Phase 1 - Core Backend & Database

### Weeks 3–6 | Milestone: All database tables created, base API running

Do not build any UI yet. Solid foundations here mean everything else is easier.

---

### 1.1 - Write All Database Migrations

Write migrations for every table defined in the UML, in dependency order:

**Week 3 - Core entities:**

- [ ] `school`
- [ ] `academic_year`
- [ ] `term`
- [ ] `class_level`
- [ ] `user`

**Week 4 - People entities:**

- [ ] `student`
- [ ] `parent`
- [ ] `teacher`
- [ ] `family_member`
- [ ] `salary`

**Week 5 - Curriculum & Classes:**

- [ ] `subject`
- [ ] `classroom`
- [ ] `class_subject`
- [ ] `class_enrollment`

**Week 6 - Grades, Finance, Timetable, Resources:**

- [ ] `transcript`
- [ ] `transcript_line`
- [ ] `fee_schedule`
- [ ] `fee_payment`
- [ ] `timetable`
- [ ] `timetable_slot`
- [ ] `academic_event`
- [ ] `learning_resource`
- [ ] `notification`
- [ ] `school_module_config`

**For each migration, also write:**

- [ ] The down migration (rollback)
- [ ] All necessary indexes (see Database Schema section of UML)
- [ ] Constraints: NOT NULL, UNIQUE, FOREIGN KEY with CASCADE rules
- [ ] Default values where applicable

---

### 1.2 - Define Shared TypeScript Types

In `packages/shared/src/types/`, define TypeScript interfaces for every entity. These are shared between frontend and backend - they are your contract.

```
packages/shared/src/
├── types/
│   ├── school.types.ts
│   ├── user.types.ts
│   ├── student.types.ts
│   ├── teacher.types.ts
│   ├── classroom.types.ts
│   ├── transcript.types.ts
│   ├── finance.types.ts
│   ├── timetable.types.ts
│   └── resource.types.ts
├── enums/
│   ├── roles.enum.ts
│   ├── status.enum.ts
│   └── appreciation.enum.ts
├── constants/
│   ├── appreciation-scale.ts   (the 0-20 grade → mention mapping)
│   └── defaults.ts
└── validation/
    ├── student.schema.ts       (Zod schemas for input validation)
    ├── teacher.schema.ts
    └── grade.schema.ts
```

---

### 1.3 - Build the Base API Server

Set up the API project structure in `apps/api/`:

```
apps/api/src/
├── server.ts               # App entry point
├── config/
│   ├── database.ts         # DB connection (SQLite or PostgreSQL)
│   └── env.ts              # Validated environment config
├── middleware/
│   ├── auth.middleware.ts  # JWT validation
│   ├── school.middleware.ts # Extract school context from token
│   ├── error.middleware.ts  # Global error handler
│   └── validate.middleware.ts # Zod input validation
├── modules/
│   ├── school/
│   │   ├── school.router.ts
│   │   ├── school.service.ts
│   │   └── school.repository.ts
│   ├── auth/
│   ├── students/
│   ├── teachers/
│   └── ... (one folder per module)
└── utils/
    ├── paginate.ts
    ├── response.ts         # Standard API response format
    └── logger.ts
```

**Standard API response format - define this now, never change it:**

```json
{
  "success": true,
  "data": { ... },
  "message": "Opération réussie",
  "pagination": {
    "page": 1,
    "per_page": 20,
    "total": 150
  }
}
```

For errors:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Le prénom est requis",
    "fields": { "first_name": "Ce champ est requis" }
  }
}
```

---

### 1.4 - Implement Core Business Logic Utilities

These are pure functions used across many modules. Build them once, test them thoroughly:

- [ ] **AppreciationCalculator**: `getAppreciation(grade: number): string` - maps 0–20 to mention
- [ ] **AverageCalculator**: `computeWeightedAverage(lines: TranscriptLine[]): number` - the most critical function in the whole app
- [ ] **CodeGenerator**: `generateStudentCode(schoolId, year): string` - creates unique codes like `TC-2025-00142`
- [ ] **ReceiptNumberGenerator**: `generateReceiptNumber(): string`
- [ ] **DateUtils**: helpers for academic year date calculations
- [ ] **Paginator**: generic pagination helper for list queries

**Write unit tests for ALL of these before moving on. Especially `computeWeightedAverage`.** Test edge cases: a student with all zeros, a student with missing grades, coefficients summing to 0.

---

### 1.5 - Create Comprehensive Seed Data

Build a seed script that creates a realistic demo school:

- [ ] 1 school: "Lycée Félix Éboué de N'Djamena"
- [ ] 1 academic year with 3 terms
- [ ] 5 class levels: 6ème, 5ème, 4ème, 3ème, Terminale
- [ ] 8 subjects with correct French names and coefficients
- [ ] 3 classrooms (Terminale A, Terminale B, 3ème A)
- [ ] 1 school master user
- [ ] 5 teachers with full profiles
- [ ] 30 students with parents
- [ ] Sample grades for 10 students (some passing, some failing)
- [ ] Sample fee payments (some paid, some partial)

This seed data is your development companion for the next 18 months. Make it realistic.

---

## Phase 2 - Authentication & School Configuration

### Weeks 7–9 | Milestone: A real school master can log in and configure their school

This is the first phase with real UI. Keep it simple - functional over beautiful.

---

### 2.1 - Authentication System

**Backend tasks:**

- [ ] `POST /auth/login` - validate credentials, return JWT + refresh token
- [ ] `POST /auth/refresh` - exchange refresh token for new access token
- [ ] `POST /auth/logout` - invalidate refresh token
- [ ] `POST /auth/change-password` - authenticated users can change password
- [ ] Middleware: extract `school_id` and `role` from JWT on every request
- [ ] Password hashing with bcrypt (min 12 rounds)
- [ ] Brute force protection: lock account after 5 failed attempts for 15 minutes
- [ ] Separate login endpoint behavior per role (different redirect targets)

**Frontend tasks:**

- [ ] Login page (French): email/username + password, show/hide password toggle
- [ ] "Mot de passe oublié" flow (if email configured)
- [ ] JWT storage: store in memory (not localStorage). Refresh token in httpOnly cookie.
- [ ] Auth context provider: `useAuth()` hook for all components
- [ ] Route guards: `<ProtectedRoute role="school_master">` component
- [ ] Auto logout on token expiry with friendly message

---

### 2.2 - School Master Dashboard Shell

- [ ] After login, school master sees their dashboard layout
- [ ] Sidebar navigation with all module links (greyed out until built)
- [ ] School name and logo in the header
- [ ] Current academic year and term displayed prominently
- [ ] User menu (profile, change password, logout)

---

### 2.3 - School Configuration Module

**This is the very first thing a school master does when setting up the software.**

Build a "Setup Wizard" that walks through:

**Step 1 - School Identity**

- [ ] Form: School name, short name, address, city, phone, email, motto
- [ ] Logo upload: drag & drop, preview, crop
- [ ] Ministry registration code (optional)
- [ ] School type: Public / Privé / Confessionnel

**Step 2 - Academic Year Setup**

- [ ] Create academic year (e.g., "2024–2025")
- [ ] Set start date and end date
- [ ] Choose grading system: Trimestres (3 terms) or Semestres (2 semesters)
- [ ] System auto-creates the term records with suggested dates
- [ ] Allow date adjustment per term
- [ ] Mark one year as "current"

**Step 3 - Class Levels**

- [ ] Add class levels (Sixième, Cinquième, Quatrième, Troisième, Seconde, Première, Terminale, etc.)
- [ ] Set order index for each level (for sorting)
- [ ] Mark if this level has a national exam (Brevet, BAC)
- [ ] Allow custom levels for primary schools (CP, CE1, CE2, CM1, CM2)

**Step 4 - Subject Catalog**

- [ ] Add all subjects the school teaches
- [ ] For each subject: name (French), code, category (Sciences, Lettres, etc.), default coefficient
- [ ] Pre-populate with common Chadian curriculum subjects:
  - Mathématiques (coeff 4/5), Physique-Chimie (coeff 3), SVT (coeff 2),
  - Français (coeff 4), Anglais (coeff 2), Philosophie (coeff 3),
  - Histoire-Géographie (coeff 2), EPS (coeff 1), etc.

**Step 5 - Fee Structure**

- [ ] For each class level + current academic year: set total fees
- [ ] Currency defaults to FCFA (XAF)
- [ ] Option to allow installment payments

**All steps:**

- [ ] Save progress after each step
- [ ] Allow returning to any step to edit
- [ ] "Configuration terminée" confirmation screen with summary

---

### 2.4 - User Management (Basic)

- [ ] School master can create teacher accounts
- [ ] School master can create student accounts
- [ ] Auto-generate username from name + year (e.g., `jdupont2025`)
- [ ] Auto-generate temporary password, displayed once
- [ ] View user list, activate/deactivate accounts

---

## Phase 3 - Student & Teacher Modules

### Weeks 10–14 | Milestone: Full student and teacher profiles can be created, searched, and managed

---

### 3.1 - Student Management

**Week 10 - Student CRUD:**

- [ ] `GET /students` - paginated list with search/filter (by name, class, status)
- [ ] `GET /students/:id` - full student profile
- [ ] `POST /students` - create student
- [ ] `PUT /students/:id` - update student
- [ ] `DELETE /students/:id` - soft delete (set status to inactive)
- [ ] Auto-generate student code on creation

**Student form fields (validate all):**

- [ ] First name, Last name (required)
- [ ] Date of birth → auto-compute age
- [ ] Gender
- [ ] Address, city
- [ ] Phone (optional, with Chadian format validation: +235...)
- [ ] Email (optional)
- [ ] Nationality (default: Tchadienne)
- [ ] Profile photo upload (optional, resize to max 200×200px)
- [ ] Status (active by default)
- [ ] Enrollment date

**Week 11 - Parent/Guardian information:**

- [ ] Add up to 3 parents/guardians per student
- [ ] For each: relation, first name, last name, phone, email, address, occupation
- [ ] Mark primary emergency contact
- [ ] Edit/remove parent records

**Week 12 - Student list UI:**

- [ ] Data table with columns: Photo, Code, Name, Class, Status, Actions
- [ ] Search bar (searches name, code)
- [ ] Filter by class level, class section, status
- [ ] Quick view panel (click row to see summary without leaving list)
- [ ] Bulk actions: export selected to Excel, change class

**Week 13 - Student profile page:**

- [ ] Header: photo, name, code, class, status badge
- [ ] Tabs: Informations personnelles, Parents, Scolarité, Notes, Frais scolaires
- [ ] Each tab loads its data lazily
- [ ] Edit button on each section (inline edit, not separate page)

---

### 3.2 - Teacher Management

**Week 13 - Teacher CRUD:**

- [ ] Same pattern as students: list, create, update, delete
- [ ] `GET /teachers`, `POST /teachers`, `PUT /teachers/:id`
- [ ] Auto-generate employee code

**Teacher form fields:**

- [ ] All personal fields (same as student)
- [ ] Qualification (highest diploma level)
- [ ] Specialization (main subject expertise)
- [ ] Hire date
- [ ] Contract type: Permanent / Contractuel / Vacataire

**Week 14 - Family and salary sections:**

- [ ] Add family members (spouse, children, parents)
- [ ] Each family member: relation, name, date of birth, phone
- [ ] Salary history table: shows all salary payments
- [ ] Add salary payment: period, gross amount, deductions, net amount, date, method (cash, virement, mobile money), status
- [ ] Auto-compute net = gross − deductions
- [ ] Export salary slip to PDF (simple one-page document)

**Teacher profile page:**

- [ ] Tabs: Informations, Famille, Matières enseignées, Salaires, Emploi du temps
- [ ] "Matières enseignées" tab: list of all classrooms and subjects assigned to this teacher

---

## Phase 4 - Class & Curriculum Management

### Weeks 15–17 | Milestone: Classes are set up, subjects assigned, teachers assigned

---

### 4.1 - Classroom Management

- [ ] Create classrooms for the current academic year
- [ ] Each classroom: level (from class_levels), section (A, B, C...), room number, capacity
- [ ] Assign a head teacher (optional)
- [ ] View classroom: see student count vs capacity, fill percentage

---

### 4.2 - Subject Assignment to Classes

This is the curriculum configuration - the most important setup step for transcript generation.

- [ ] For each classroom, add subjects from the school's subject catalog
- [ ] For each class-subject: set the coefficient (pre-filled from subject default, editable)
- [ ] Assign a teacher to each class-subject
- [ ] Set hours per week (for timetable)
- [ ] Mark optional subjects (e.g., Arabic, EPS under certain conditions)
- [ ] Show warning if a teacher is assigned to more than X hours/week (overload alert)

**UI for this: "Grille horaire de la classe"** - a table showing:

```
Matière          | Enseignant       | Coefficient | H/Semaine
─────────────────┼──────────────────┼─────────────┼──────────
Mathématiques    | M. Mahamat Idriss|      4      |    5h
Physique-Chimie  | Mme Fatimé Ali   |      3      |    4h
Français         | M. Jean-Pierre N.|      4      |    5h
...
```

- [ ] Validate: total coefficient must be reasonable (warn if > 40)
- [ ] Copy curriculum from another class or previous year (save setup time)
- [ ] Import curriculum from Excel template

---

### 4.3 - Student Enrollment in Classes

- [ ] Enroll students into a classroom for the current year
- [ ] Bulk enrollment: select multiple students → assign to class
- [ ] Transfer student from one class to another (with reason)
- [ ] View class roster: sortable, searchable student list
- [ ] Export class list to PDF (official class register format)
- [ ] Auto-check: alert if student not enrolled in any class

---

## Phase 5 - Grades & Transcript Engine

### Weeks 18–23 | Milestone: Teachers can enter grades; transcripts auto-compute and display correctly

This is the **heart of the system**. Take the most time here. Test obsessively.

---

### 5.1 - Transcript Initialization

- [ ] When a term begins (or manually triggered by school master), the system initializes transcript records
- [ ] For every enrolled student × current classroom × current term → create `transcript` record
- [ ] For every class-subject in that classroom → create `transcript_line` record for each student
- [ ] Status: all transcripts start as `PENDING`
- [ ] `POST /transcripts/initialize` → triggered by school master, creates all records in bulk
- [ ] Show progress indicator (could be thousands of records for large schools)

---

### 5.2 - Grade Entry Interface (Teacher View)

This is the most-used interface in the entire system. It must be fast, reliable, and easy.

**Teacher selects:**

1. Their assigned class (from a dropdown of their classes)
2. Their subject (auto-filtered to their assignments)
3. The current term (pre-selected, can change)

**Then they see a grade entry table:**

```
N° | Nom & Prénom          | Note (/20) | Absences | Commentaire
───┼───────────────────────┼────────────┼──────────┼─────────────
 1 | ABDERAMANE Moussa     | [  14.5  ] |   [2]    | [           ]
 2 | AHMAT Fatimé          | [  17.0  ] |   [0]    | [           ]
 3 | ALI Hassan            | [   7.5  ] |   [5]    | [Difficultés]
...
```

**Grade entry rules:**

- [ ] Input must be between 0.00 and 20.00 (validate in real-time)
- [ ] Accept decimal with comma OR period (French keyboard uses comma: "14,5" = 14.5)
- [ ] Tab key moves to next student (keyboard-first workflow for speed)
- [ ] Enter key also moves down
- [ ] Auto-save every 30 seconds (no data loss if app crashes)
- [ ] Show appreciation label next to each grade in real-time: 14.5 → "Bien"
- [ ] Highlight failing grades (< 10) in orange/red
- [ ] Show class statistics live: average, highest, lowest as grades are entered
- [ ] "Valider les notes" button: locks this teacher's grades for this subject
- [ ] After validation: grades are read-only (school master can unlock if needed)
- [ ] Show validation status: "3/8 matières validées"

**Backend:**

- [ ] `GET /transcripts/entry?classroomId=X&subjectId=Y&termId=Z` - returns the list of students with their current grade
- [ ] `PUT /transcript-lines/:id` - update one grade
- [ ] `POST /transcript-lines/bulk-save` - save all grades for one subject at once
- [ ] `POST /transcript-lines/validate` - lock grades for a subject/class/term
- [ ] Authorization: teacher can only enter grades for their assigned class-subjects

---

### 5.3 - Automatic Computation Engine

This runs after all grades for a class are validated, or on-demand.

**`computeTranscript(transcriptId)`:**

```
For each transcript_line:
  1. weighted_score = grade_value × coefficient
  2. appreciation = AppreciationScale.get(grade_value)

For the transcript:
  3. total_coefficient = SUM(coefficient) for all lines
  4. total_weighted_score = SUM(weighted_score) for all lines
  5. overall_average = total_weighted_score / total_coefficient
     → round to 2 decimal places
  6. appreciation = AppreciationScale.get(overall_average)
  7. is_passed = overall_average >= 10.00
```

**`computeClassRanks(classroomId, termId)`:**

```
1. Get all transcripts for classroom + term
2. Sort by overall_average descending
3. Assign rank: ties get same rank (e.g., two students at 15.25 both get rank 1)
4. Update rank_in_class on each transcript
```

- [ ] Endpoint: `POST /transcripts/compute?classroomId=X&termId=Y`
- [ ] Endpoint: `POST /transcripts/compute-ranks?classroomId=X&termId=Y`
- [ ] Show school master a "compute all" button with progress indicator
- [ ] Warn if any subject has unvalidated grades (will compute with blanks)
- [ ] Store computation timestamp

---

### 5.4 - Transcript View (School Master)

- [ ] List view: all classes → click to see class transcripts for current term
- [ ] For each class: table showing all students with average, rank, passed/failed status
- [ ] Color coding: green (passed), red (failed), yellow (borderline: 9–10)
- [ ] Filter by: passed only, failed only, by appreciation category
- [ ] Sort by: rank, name, average
- [ ] Individual transcript view: full transcript for one student

---

### 5.5 - Transcript View (Student)

- [ ] Student logs in → sees their transcript for the current term
- [ ] View past terms via a selector
- [ ] Shows: all subjects, grade, mention, coefficient, weighted score
- [ ] Shows: overall average, mention, rank in class, passed/failed status
- [ ] Cannot edit anything - read only
- [ ] Download as PDF button

---

### 5.6 - The Appreciation Scale

Implement as a constant, not in the database (it does not change per school in the Chadian system):

```typescript
// appreciation-scale.ts
export const APPRECIATION_SCALE = [
  { min: 18.00, max: 20.00, label: "Excellent",     color: "#1a7a1a" },
  { min: 16.00, max: 17.99, label: "Très Bien",     color: "#2d9e2d" },
  { min: 14.00, max: 15.99, label: "Bien",          color: "#4db84d" },
  { min: 12.00, max: 13.99, label: "Assez Bien",    color: "#7dc87d" },
  { min: 10.00, max: 11.99, label: "Passable",      color: "#f5a623" },
  { min:  8.00, max:  9.99, label: "Insuffisant",   color: "#e07b00" },
  { min:  6.00, max:  7.99, label: "Faible",        color: "#d44000" },
  { min:  0.00, max:  5.99, label: "Très Faible",   color: "#c0392b" },
];

export function getAppreciation(grade: number): string { ... }
export function isPassed(average: number): boolean { return average >= 10.00; }
```

---

## Phase 6 - Finance Module

### Weeks 24–26 | Milestone: School can record and track student fee payments

---

### 6.1 - Fee Schedule Setup

- [ ] School master sets fee amount per class level per academic year
- [ ] Option to allow installment payments (2 or 3 installments)
- [ ] Set due date for full payment
- [ ] View/edit existing fee schedules

---

### 6.2 - Payment Recording

- [ ] Record a payment: select student → auto-shows their class and applicable fee schedule
- [ ] Enter: amount paid, payment date, payment method (cash/mobile money/virement)
- [ ] Auto-generate receipt number
- [ ] Notes field (e.g., "Versement partiel, reste à payer avant le 15/03")
- [ ] Show real-time: amount due, total paid so far, balance remaining
- [ ] Print receipt (simple PDF, A5 format)

---

### 6.3 - Payment Status Views

- [ ] Per-student: full payment history with totals
- [ ] Class view: table of all students in a class with fee status (paid/partial/unpaid)
- [ ] Color coding: green (fully paid), orange (partial), red (unpaid)
- [ ] School-wide: total expected vs total collected for the year
- [ ] List of students with unpaid balance (for reminder purposes)
- [ ] Export: Excel export of payment status per class

---

## Phase 7 - Timetable & Academic Calendar

### Weeks 27–29 | Milestone: Classes have timetables; students can view their schedule

---

### 7.1 - Academic Events Calendar

- [ ] School master creates events: holidays, exam periods, parent meetings
- [ ] Events can apply to whole school or specific class levels
- [ ] Visual calendar view (monthly/weekly)
- [ ] Students and teachers see the calendar in their portal

---

### 7.2 - Weekly Timetable Builder

- [ ] For each classroom, school master builds the weekly timetable
- [ ] Drag-and-drop interface: drag a class-subject onto a day/time slot
- [ ] Each slot: subject, teacher, room, day, start time, end time
- [ ] Conflict detection: alert if same teacher is double-booked at the same time
- [ ] Conflict detection: alert if same room is double-booked
- [ ] "Publish" timetable: makes it visible to students and teachers
- [ ] Print timetable: export as PDF (formatted A4, portrait)

---

### 7.3 - Timetable Views (Teacher & Student)

- [ ] Teacher view: their personal timetable across all their classes
- [ ] Student view: their class timetable (read only, published only)
- [ ] Both views: current week highlighted, next event shown prominently

---

## Phase 8 - Import / Export & Excel Integration

### Weeks 30–32 | Milestone: School can populate the system from Excel in minutes

This phase dramatically reduces setup time for new schools.

---

### 8.1 - Excel Templates

Create professionally formatted Excel templates (in French) that schools fill in:

- [ ] **Student Import Template** (`Modèle_Import_Eleves.xlsx`):
  - Columns: Nom, Prénom, Date de naissance, Sexe, Adresse, Téléphone, Email, Classe, Nom père, Téléphone père, Nom mère, Téléphone mère
  - Include a sample row
  - Include validation rules in the Excel file (dropdowns for gender, class)
  - Include instructions on the first sheet

- [ ] **Teacher Import Template** (`Modèle_Import_Enseignants.xlsx`):
  - Columns: Nom, Prénom, Date de naissance, Sexe, Spécialité, Qualification, Date d'embauche, Téléphone, Email, Salaire brut

- [ ] **Grade Import Template** (`Modèle_Import_Notes.xlsx`):
  - Generated dynamically per class per term: first column is student name/code, remaining columns are subjects
  - School master downloads template (pre-filled with students and subjects), gives to teachers, teachers fill grades, template is re-imported

---

### 8.2 - Import Engine

For each template:

- [ ] Parse Excel file with SheetJS
- [ ] Map columns to entity fields
- [ ] Validate each row (required fields, data types, valid values)
- [ ] Show preview of parsed data before final import (with row-level error highlighting)
- [ ] User confirms import
- [ ] Process: create/update records in bulk
- [ ] Show result: X imported, Y skipped, Z errors with details
- [ ] Error rows can be downloaded as Excel for correction and re-import

**Grade import specifically:**

- [ ] Match student by code OR by exact name match
- [ ] Match subject by name or code
- [ ] Only update grades that are not yet validated
- [ ] Show side-by-side: current grade vs imported grade (let user choose)

---

### 8.3 - Export Engine

- [ ] **Student list → Excel**: with all profile fields, filterable by class
- [ ] **Teacher list → Excel**: with all profile fields
- [ ] **Grade sheet → Excel**: per class, per term - shows all students and all grades
- [ ] **Payment report → Excel**: per class, all fee payment history
- [ ] **Salary report → Excel**: per teacher or all teachers, for a given period
- [ ] All exports: school name and logo in header, date of export in footer

---

## Phase 9 - Desktop App Packaging

### Weeks 33–35 | Milestone: The app can be installed on a Windows PC and works offline

---

### 9.1 - Tauri Integration

- [ ] Set up Tauri in `apps/desktop/`
- [ ] Bundle the React frontend as the WebView content
- [ ] Bundle the API backend as a Tauri sidecar (runs as local process)
- [ ] Bundle SQLite database - app creates/manages its own DB file on disk
- [ ] Configure file system permissions: write to `AppData/EduTrack/` (Windows)
- [ ] App icon (use school's logo pattern or a generic EduTrack icon)
- [ ] Splash screen while app loads
- [ ] Window title: "EduTrack Africa - [School Name]"

---

### 9.2 - Offline Mode

- [ ] All reads and writes go to local SQLite
- [ ] Background sync process: when internet is available, push local changes to cloud
- [ ] Sync conflict resolution: last-write-wins per record (log conflicts for review)
- [ ] Sync status indicator in the app header: "Synchronisé il y a 2 minutes" or "Hors ligne"
- [ ] Manual sync button: "Synchroniser maintenant"
- [ ] If syncing fails for >24 hours: prominent warning to admin

---

### 9.3 - Auto-Update System

- [ ] Check for updates on startup (if online)
- [ ] Download update in background
- [ ] Prompt user to restart and apply update
- [ ] Update changelog shown in French
- [ ] Never auto-update without user confirmation (schools are risk-averse)

---

### 9.4 - Windows Installer

- [ ] Build Windows NSIS installer (`.exe`)
- [ ] Installer includes: app, SQLite, required runtimes
- [ ] Desktop shortcut created on install
- [ ] Uninstaller included
- [ ] Digital code signing of the installer (to avoid Windows SmartScreen block)
- [ ] Test on Windows 10 and Windows 11 (most common in Chadian schools)
- [ ] Test on low-spec hardware: 4GB RAM, HDD (not SSD), Intel Core i3

---

## Phase 10 - Student Portal & Resources

### Weeks 36–38 | Milestone: Students can log in and see their profile, grades, fees, and resources

---

### 10.1 - Student Dashboard

After login, student sees:

- [ ] Welcome message with their name and class
- [ ] Current term name and days remaining
- [ ] Quick stats: overall average (if computed), rank (if computed)
- [ ] Recent notifications from school
- [ ] Upcoming events from the calendar

---

### 10.2 - Student Profile View

- [ ] Read-only view of their personal information
- [ ] Parents/guardians contact info
- [ ] Enrollment history (class per year)
- [ ] Profile photo

---

### 10.3 - Transcript View for Students

- [ ] Current term transcript (if computed and published)
- [ ] Past terms selectable
- [ ] Beautiful, clean transcript display matching the PDF format
- [ ] Download as PDF button (same PDF as the official one, watermarked "COPIE ÉLÈVE")

---

### 10.4 - Fee Status View for Students

- [ ] How much they owe total
- [ ] How much has been paid
- [ ] Payment history table
- [ ] Balance due (with due date if applicable)
- [ ] No payment can be made through the app - this is view only

---

### 10.5 - Learning Resources

- [ ] Browse resources by subject, by class level, by type (document, video link, exam)
- [ ] Search resources
- [ ] Download/open documents (PDFs open in the app's PDF viewer)
- [ ] Track download count (for teachers to see what's popular)

**Teacher resource management:**

- [ ] Teacher uploads: drag & drop file or paste a link
- [ ] Set title, description, subject, target level
- [ ] Toggle visibility: visible to students or draft only
- [ ] Delete their own resources

---

## Phase 11 - Reporting & Analytics

### Weeks 39–42 | Milestone: School master has full visibility into school performance

---

### 11.1 - School Dashboard (School Master)

Real-time summary of the school:

- [ ] Total students (active), by class level breakdown
- [ ] Transcripts status: X% of all transcripts finalized for current term
- [ ] School-wide pass rate for current term
- [ ] Top 10 students in the school this term
- [ ] Fee collection: total collected / total expected this year (%)
- [ ] Teachers with unvalidated grades (alert)

---

### 11.2 - Class-Level Reports

For each class or class level:

- [ ] Full results table: student, average, rank, passed/failed
- [ ] Statistics: class average, highest, lowest, standard deviation
- [ ] Pass rate (% passed)
- [ ] Distribution chart: how many students in each appreciation bracket
- [ ] Subject-by-subject averages for the class
- [ ] Compare this term vs previous term (trend arrows)

---

### 11.3 - Rankings & Best Students

- [ ] **School-wide ranking**: top N students across all classes (sorted by average)
- [ ] **Per class ranking**: top N in each classroom
- [ ] **Per subject ranking**: best grade in each subject, per class and school-wide
- [ ] **Best student by category**: best in Sciences, best in Lettres, etc.
- [ ] Toggle between terms and academic years
- [ ] Export rankings to Excel or PDF

---

### 11.4 - Pass / Fail Analytics

- [ ] Breakdown of passed vs failed per class
- [ ] Students who failed by borderline (9.00–9.99) - the "conseil de classe" list
- [ ] Students who failed multiple subjects (at-risk students)
- [ ] Year-over-year pass rate comparison (if previous year data exists)
- [ ] Export failed student list for intervention

---

### 11.5 - Financial Reports

- [ ] Total fees expected vs collected per class level
- [ ] Monthly collection trend
- [ ] Top unpaid classes/students
- [ ] Teacher salary totals per month, per year
- [ ] Export all financial data to Excel

---

## Phase 12 - Digital Signatures & PDF Engine

### Weeks 43–45 | Milestone: Official transcripts can be digitally signed and exported as PDFs

---

### 12.1 - Digital Signature Infrastructure

- [ ] On first login, school master generates a digital signing certificate (RSA 2048-bit key pair)
- [ ] Private key stored encrypted on the device (never leaves the device)
- [ ] Public key stored in the database
- [ ] Signing a transcript: creates a cryptographic hash of the transcript data signed with the private key
- [ ] The signature, public key fingerprint, timestamp, and signer name are embedded in the PDF
- [ ] Verification: anyone with the public key can verify the transcript is authentic
- [ ] Simple UI: "Signer ce bulletin" button → password prompt → signature applied

---

### 12.2 - Transcript PDF Layout

Design the official transcript PDF with maximum precision:

**Header:**

- [ ] Republic of Chad header (République du Tchad)
- [ ] Ministry of Education line
- [ ] School name and logo
- [ ] "BULLETIN DE NOTES" title, term and academic year

**Student info block:**

- [ ] Name, class, student code, school year

**Grades table:**

```
Matières          | Note /20 | Coeff | Points | Mention
──────────────────┼──────────┼───────┼────────┼──────────
Mathématiques     |   14.50  |   4   |  58.00 | Bien
Physique-Chimie   |   12.00  |   3   |  36.00 | Assez Bien
Français          |   16.00  |   4   |  64.00 | Très Bien
...
──────────────────┼──────────┼───────┼────────┼──────────
TOTAL             |          |  34   | 468.50 |
MOYENNE GÉNÉRALE  |   13.78  |       |        | Bien
```

**Results block:**

- [ ] Moyenne générale, Mention, Rang dans la classe, Élèves notés
- [ ] Résultat: ADMIS / AJOURNÉ

**Signature block:**

- [ ] "Le Directeur / La Directrice", signature placeholder, date
- [ ] Digital signature indicator with verification hash (small print)
- [ ] School stamp area

**Footer:**

- [ ] School address, contact info
- [ ] "Ce bulletin est généré et signé numériquement par EduTrack Africa"

---

### 12.3 - Bulk PDF Operations

- [ ] Generate all transcripts for a class at once → ZIP file of individual PDFs
- [ ] Name files: `Bulletin_[NomPrenom]_[Classe]_[Trimestre].pdf`
- [ ] Progress bar for bulk generation
- [ ] Option: generate one combined PDF (all students in one document, one per page)

---

## Phase 13 - Notifications & Communication

### Weeks 46–47 | Milestone: School master can send announcements; users receive alerts

---

### 13.1 - In-App Notification Center

- [ ] Bell icon in header with unread count badge
- [ ] Notification panel: list of recent notifications with title, time, read/unread state
- [ ] Mark as read, mark all as read
- [ ] School master can create announcements: title, message, target (all / teachers / students)
- [ ] System auto-notifications:
  - "Vos notes de Mathématiques ont été validées" (to students when grades are finalized)
  - "Nouvelle ressource disponible en Français" (to students when teacher uploads)
  - "X élèves n'ont pas encore payé leurs frais" (to school master)

---

### 13.2 - SMS Notifications (Optional, Phase 2)

- [ ] Integrate Africa's Talking SMS API (supports Chad/N'Djamena)
- [ ] Send SMS to parents when transcript is published
- [ ] Send SMS payment reminders
- [ ] School master can send custom SMS to all parent contacts
- [ ] Cost tracking: show number of SMS sent and estimated cost
- [ ] This feature is opt-in and requires the school to have an SMS API account

---

## Phase 14 - Testing, QA & Hardening

### Weeks 48–51 | Milestone: System is reliable, secure, and ready for real schools

Testing is not a final phase - it runs in parallel from Phase 1. This phase is **dedicated hardening**.

---

### 14.1 - Unit Tests

Target 80%+ coverage on:

- [ ] `AppreciationCalculator` - all boundary values
- [ ] `AverageCalculator` - weighted average with various coefficient combinations
- [ ] `AuthService` - login, token generation, permission checking
- [ ] `TranscriptService` - compute, rank, finalize flows
- [ ] `FinanceService` - payment recording, status computation
- [ ] All Zod validation schemas - valid and invalid inputs

---

### 14.2 - Integration Tests

- [ ] Full grade entry flow: initialize transcripts → enter grades → validate → compute → view
- [ ] Excel import flow: upload file → preview → confirm → verify records created
- [ ] PDF generation: generate transcript PDF and verify it contains correct data
- [ ] Auth flow: login → access protected endpoint → refresh token → logout

---

### 14.3 - End-to-End Tests (Playwright)

- [ ] School master setup wizard: complete from scratch
- [ ] Teacher entering grades for a full class
- [ ] Student viewing transcript and downloading PDF
- [ ] Excel import of 100 students
- [ ] Full term workflow: from transcript initialization to signed PDF

---

### 14.4 - Security Audit

- [ ] SQL injection: all queries use parameterized statements (ORM enforces this)
- [ ] XSS: React's JSX escapes by default; audit any `dangerouslySetInnerHTML` usages
- [ ] CSRF: verify all state-changing endpoints require auth tokens
- [ ] Authorization: manually test that a teacher cannot access another school's data
- [ ] Authorization: manually test that a student cannot see another student's grades
- [ ] File uploads: validate MIME type and file size; scan for executable content
- [ ] Rate limiting: login endpoint must be rate-limited
- [ ] Sensitive data: no passwords, keys, or PII in logs

---

### 14.5 - Performance Testing

- [ ] Load test the grade entry endpoint with 500 concurrent writes
- [ ] Test PDF bulk generation with a class of 60 students
- [ ] Test Excel import with 1,000 student rows
- [ ] Test on slow network (3G simulation): all pages must load under 5 seconds
- [ ] Test on low-spec Windows PC: Intel Core i3, 4GB RAM, no SSD

---

### 14.6 - Data Validation & Edge Cases

- [ ] Student with no grades: transcript should show dashes, not crash
- [ ] Class with 0 students enrolled: no division by zero errors
- [ ] Grade of exactly 10.00: must be marked as PASSED
- [ ] Grade of 9.99: must be marked as FAILED
- [ ] All subjects have coefficient 0: system must handle gracefully
- [ ] Duplicate student name: system must allow (use code as unique identifier)

---

## Phase 15 - Pilot Deployment

### Weeks 52–56 | Milestone: 1–2 real schools using the system for a full term

---

### 15.1 - Pilot School Selection

- [ ] Identify 1–2 willing schools in Chad (ideally N'Djamena for connectivity)
- [ ] Prefer a school with: 200–500 students, 15–25 teachers, existing grade records
- [ ] Sign a simple agreement: they test for free, provide feedback, data is confidential
- [ ] Assign one person at the school as the "EduTrack Coordinator" - your on-the-ground contact

---

### 15.2 - Pilot Setup

- [ ] Install the desktop app on the school's computers (1–3 machines)
- [ ] Training session (half-day): school master + 3–5 teachers
  - Module 1: School configuration (1 hour)
  - Module 2: Entering students and teachers (1 hour)
  - Module 3: Grade entry for teachers (30 minutes)
  - Module 4: Viewing transcripts and reports (30 minutes)
- [ ] Import existing student data from Excel
- [ ] Configure the current academic year and term
- [ ] Create initial transcripts

---

### 15.3 - Pilot Monitoring

- [ ] Weekly check-in call with school coordinator
- [ ] Collect feedback using a simple Google Form (in French)
- [ ] Track: bugs found, features requested, confusion points, time saved
- [ ] Bug priority system: Critical (app crashes/data loss) → fix in 24h; Major (wrong calculation) → fix in 48h; Minor (UI issue) → fix in next release
- [ ] Keep a change log: share with the pilot school so they see progress

---

### 15.4 - Pilot Success Criteria

The pilot is successful if:

- [ ] School master can configure the full school setup without external help
- [ ] Teachers can enter all grades for one full term without training support
- [ ] Transcripts are generated correctly (verified against manually computed ones)
- [ ] At least 80% of pilot participants say it is easier than their previous system
- [ ] Zero data loss events

---

## Phase 16 - Scale & Multi-School

### Weeks 57–64 | Milestone: System supports 10+ schools, cloud sync operational

---

### 16.1 - Multi-Tenant Hardening

- [ ] Verify every single database query includes `school_id` filter
- [ ] Automated test: create two schools, verify data never crosses between them
- [ ] School master of school A cannot access school B under any circumstances
- [ ] Introduce a `SuperAdmin` role: can see all schools, manage subscriptions, global config

---

### 16.2 - Cloud Sync Production Setup

- [ ] Deploy PostgreSQL on a reliable African-region cloud provider (consider OVH Gravelines for good latency to Chad, or AWS Af-South-1 in Johannesburg)
- [ ] Set up automated daily backups of the cloud database
- [ ] Implement the sync engine: push SQLite changes → PostgreSQL on reconnect
- [ ] Sync status dashboard for SuperAdmin: see which schools synced when

---

### 16.3 - Web Interface for Remote Access

- [ ] Deploy the web app (React) so it can be accessed from any browser
- [ ] This uses the cloud PostgreSQL database (no SQLite)
- [ ] Optimized for mobile (teachers checking grades from their phone)
- [ ] Same codebase as desktop - responsive Tailwind CSS handles layout
- [ ] PWA (Progressive Web App): installable on Android phones, works offline

---

### 16.4 - School Onboarding Flow

As more schools join:

- [ ] SuperAdmin creates a new school tenant with a few clicks
- [ ] New school master receives login credentials by email or SMS
- [ ] First login triggers the setup wizard
- [ ] Onboarding checklist visible until all core steps are done

---

### 16.5 - Subscription & Licensing (If Commercializing)

- [ ] Define pricing tiers: Free (up to 100 students), Standard (500 students), Premium (unlimited)
- [ ] License key system: desktop app validates license on startup (with grace period for offline)
- [ ] Payment: accept Mobile Money (Airtel Money, Orange Money) - the most practical for Chad
- [ ] Invoice/receipt generation for school records

---

## Milestone Checklist

```
□  Phase 0  Complete │ Dev environment scaffolded, DB migrations running
□  Phase 1  Complete │ All tables created, seed data working, base API running
□  Phase 2  Complete │ School master can log in and configure school
□  Phase 3  Complete │ Students & teachers fully manageable
□  Phase 4  Complete │ Classes set up with subjects and teachers assigned
□  Phase 5  Complete │ Grades entered, transcripts computed correctly (CRITICAL)
□  Phase 6  Complete │ Fee payments recorded and tracked
□  Phase 7  Complete │ Timetables built and viewable
□  Phase 8  Complete │ Excel import/export working for all entities
□  Phase 9  Complete │ Desktop app installs and runs offline on Windows
□  Phase 10 Complete │ Students can log in and use their portal
□  Phase 11 Complete │ Analytics and ranking reports working
□  Phase 12 Complete │ Official transcripts signed and exported as PDF
□  Phase 13 Complete │ In-app notifications working
□  Phase 14 Complete │ Tests pass, security audit done, performance acceptable
□  Phase 15 Complete │ 2 pilot schools running for one full term
□  Phase 16 Complete │ Multi-school cloud deployment operational
```

---

## Risk Register

```
┌─────────────────────────────────┬──────────┬────────────┬──────────────────────────────────┐
│ Risk                            │Likelihood│  Impact    │ Mitigation                       │
├─────────────────────────────────┼──────────┼────────────┼──────────────────────────────────┤
│ Grade computation error         │ Medium   │ CRITICAL   │ Exhaustive unit tests; verify    │
│ (wrong average on transcripts)  │          │            │ against manually computed results │
├─────────────────────────────────┼──────────┼────────────┼──────────────────────────────────┤
│ Data loss on desktop (disk      │ Medium   │ HIGH       │ Auto-backup to cloud daily;      │
│ failure, accidental deletion)   │          │            │ manual backup export button      │
├─────────────────────────────────┼──────────┼────────────┼──────────────────────────────────┤
│ Low adoption by teachers        │ High     │ HIGH       │ Grade entry UI must be simple;   │
│ (reluctance to use software)    │          │            │ training session mandatory;      │
│                                 │          │            │ mobile access helps              │
├─────────────────────────────────┼──────────┼────────────┼──────────────────────────────────┤
│ No internet at pilot school     │ High     │ MEDIUM     │ Desktop app works 100% offline;  │
│                                 │          │            │ sync is bonus, not requirement   │
├─────────────────────────────────┼──────────┼────────────┼──────────────────────────────────┤
│ Power outages during data entry │ High     │ MEDIUM     │ Auto-save every 30 seconds;      │
│                                 │          │            │ UPS recommendation to schools    │
├─────────────────────────────────┼──────────┼────────────┼──────────────────────────────────┤
│ Scope creep (adding features    │ Very High│ HIGH       │ Strict phase gating; no new      │
│ before core is solid)           │          │            │ features until current phase done│
├─────────────────────────────────┼──────────┼────────────┼──────────────────────────────────┤
│ Wrong curriculum assumptions    │ Medium   │ HIGH       │ Validate Chadian curriculum with │
│ (wrong coefficients, subjects)  │          │            │ school advisor before Phase 4    │
├─────────────────────────────────┼──────────┼────────────┼──────────────────────────────────┤
│ Windows compatibility issues    │ Low      │ MEDIUM     │ Test on actual school hardware   │
│ (old Windows 7/8 machines)      │          │            │ early; Tauri supports Win 10+    │
├─────────────────────────────────┼──────────┼────────────┼──────────────────────────────────┤
│ Solo developer burnout          │ Medium   │ HIGH       │ Strict time-boxing per phase;    │
│                                 │          │            │ celebrate milestones; involve    │
│                                 │          │            │ school advisor for motivation    │
└─────────────────────────────────┴──────────┴────────────┴──────────────────────────────────┘
```

---

## Definition of Done

A phase is **Done** when ALL of the following are true:

1. **All tasks in the phase checklist are checked off**
2. **All new code has unit tests** (where applicable)
3. **No known critical bugs** (data loss, wrong computation, crash on startup)
4. **The feature works offline** (for desktop) and online (for web)
5. **All UI text is in French** with no placeholder strings visible
6. **A non-developer (school advisor) has tested the feature** and found it understandable
7. **The seed data script still works** (new tables/data added where needed)
8. **The code is reviewed** (if solo: at minimum, read your own code after sleeping on it)
9. **The milestone is documented**: update `CHANGELOG.md` with what was built

---

## Final Advice

**Start with Phase 5 in mind, always.**
Every decision you make in Phases 0–4 should be made with the transcript engine in mind. That is your core value proposition. Everything else is supporting cast.

**Respect the school's existing culture.**
Schools in Chad may print transcripts and stamp them physically. Your PDF must match or exceed the quality of what they currently produce. Show pride in the output.

**Build something you would be proud to show a teacher in N'Djamena.**
That is your north star.

---

_EduTrack Africa Development Roadmap - Version 1.0 - May 2026_
_Total estimated duration: 12–18 months (solo developer) | 8–10 months (team of 3)_
