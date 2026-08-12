# 🏫 EduTrack Africa - School Management System

## Complete UML & Architecture Design Document

### Designed for Schools in Chad and Across Africa

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Module Map](#3-module-map)
4. [Entity-Relationship Diagram (ERD)](#4-entity-relationship-diagram-erd)
5. [Class Diagrams by Module](#5-class-diagrams-by-module)
   - 5.1 [Core / School Configuration Module](#51-core--school-configuration-module)
   - 5.2 [User & Authentication Module](#52-user--authentication-module)
   - 5.3 [Student Module](#53-student-module)
   - 5.4 [Teacher Module](#54-teacher-module)
   - 5.5 [Class & Curriculum Module](#55-class--curriculum-module)
   - 5.6 [Grades & Transcript Module](#56-grades--transcript-module)
   - 5.7 [Finance Module](#57-finance-module)
   - 5.8 [Timetable & Academic Calendar Module](#58-timetable--academic-calendar-module)
   - 5.9 [Resources & Learning Module](#59-resources--learning-module)
   - 5.10 [Reporting & Analytics Module](#510-reporting--analytics-module)
   - 5.11 [Import / Export Module](#511-import--export-module)
   - 5.12 [Notification Module](#512-notification-module)
6. [Relationship Summary](#6-relationship-summary)
7. [Use Case Diagrams](#7-use-case-diagrams)
8. [Sequence Diagrams](#8-sequence-diagrams)
9. [State Diagrams](#9-state-diagrams)
10. [Database Schema Overview](#10-database-schema-overview)
11. [System Roles & Permissions Matrix](#11-system-roles--permissions-matrix)
12. [Scalability & Modularity Notes](#12-scalability--modularity-notes)
13. [Technology Stack Recommendation](#13-technology-stack-recommendation)

---

## 1. System Overview

**EduTrack Africa** is a comprehensive, multi-functional School Management System (SMS) designed primarily for African schools - starting with Chad - where digital school management infrastructure is limited or absent.

### Key Principles

- **Multi-tenant**: Each school is configured independently with its own name, logo, classes, and fee structures.
- **Role-based**: Distinct interfaces and access levels for School Master, Teachers, and Students.
- **Offline-first Desktop + Web**: Primary desktop application (Electron/Tauri), with a synchronized web interface.
- **Modular**: Every feature is a pluggable module. Schools can enable/disable modules per their needs.
- **Scalable**: Designed to grow from a single school to a network of schools (multi-school federation).
- **Localizable**: Supports French (primary), Arabic, and English interfaces.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          EduTrack Africa System                          │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                      Presentation Layer                          │   │
│  │  ┌─────────────────┐   ┌──────────────────┐  ┌───────────────┐  │   │
│  │  │  Desktop App     │   │  Web App (Mobile)│  │ Web App (PC)  │  │   │
│  │  │  (Electron/Tauri)│   │  (Responsive PWA)│  │  (Browser)    │  │   │
│  │  └────────┬────────┘   └────────┬─────────┘  └───────┬───────┘  │   │
│  └───────────┼────────────────────┼───────────────────── ┼──────────┘   │
│              └────────────────────┴──────────────────────┘              │
│                                   │                                     │
│  ┌────────────────────────────────▼────────────────────────────────┐   │
│  │                        API Gateway / REST Layer                   │   │
│  │              (Authentication • Rate Limiting • Routing)           │   │
│  └────────────────────────────────┬────────────────────────────────┘   │
│                                   │                                     │
│  ┌────────────────────────────────▼────────────────────────────────┐   │
│  │                         Business Logic Layer                      │   │
│  │                                                                   │   │
│  │  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐  │   │
│  │  │  Student  │ │ Teacher  │ │  Grades  │ │Finance │ │Timetbl │  │   │
│  │  │  Module   │ │  Module  │ │  Module  │ │ Module │ │ Module │  │   │
│  │  └───────────┘ └──────────┘ └──────────┘ └────────┘ └────────┘  │   │
│  │  ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌────────┐ ┌────────┐  │   │
│  │  │  Class &  │ │ Resource │ │ Reporting│ │Import/ │ │Notific-│  │   │
│  │  │Curriculum │ │ Module   │ │ Module   │ │Export  │ │ ation  │  │   │
│  │  └───────────┘ └──────────┘ └──────────┘ └────────┘ └────────┘  │   │
│  └────────────────────────────────┬────────────────────────────────┘   │
│                                   │                                     │
│  ┌────────────────────────────────▼────────────────────────────────┐   │
│  │                         Data Access Layer                         │   │
│  │              (ORM • Repository Pattern • Query Builder)           │   │
│  └────────────────────────────────┬────────────────────────────────┘   │
│                                   │                                     │
│  ┌────────────────────────────────▼────────────────────────────────┐   │
│  │                        Persistence Layer                          │   │
│  │   ┌─────────────────┐            ┌──────────────────────────┐    │   │
│  │   │  Local Database │            │   Cloud Database (Sync)   │    │   │
│  │   │  (SQLite)       │◄──sync────►│   (PostgreSQL / Supabase) │    │   │
│  │   └─────────────────┘            └──────────────────────────┘    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Module Map

```
EduTrack Africa
│
├── 📦 MOD-01: Core / School Configuration
│   ├── School Profile (name, logo, address, academic year)
│   ├── Class Levels & Sections
│   ├── Academic Year & Term Configuration
│   └── Fee Schedule per Level
│
├── 📦 MOD-02: User & Authentication
│   ├── Role Management (SchoolMaster, Teacher, Student)
│   ├── Login / Session Management
│   └── Digital Signature Infrastructure
│
├── 📦 MOD-03: Student Management
│   ├── Student Profile (personal info, parents)
│   ├── Enrollment & Class Assignment
│   └── Status Tracking (active, graduated, transferred)
│
├── 📦 MOD-04: Teacher Management
│   ├── Teacher Profile (personal, family info)
│   ├── Course & Class Assignments
│   └── Payroll / Salary Tracking
│
├── 📦 MOD-05: Class & Curriculum
│   ├── Class Roster Management
│   ├── Subject / Course Definitions
│   └── Coefficient Definitions per Subject
│
├── 📦 MOD-06: Grades & Transcripts
│   ├── Grade Entry Interface (Teacher)
│   ├── Automatic Average Computation
│   ├── Automatic Appreciation (mention)
│   ├── Transcript Generation (PDF)
│   └── Digital Signature on Transcript
│
├── 📦 MOD-07: Finance
│   ├── Fee Structure per Level
│   ├── Payment Recording
│   ├── Payment Status per Student
│   └── Financial Reports
│
├── 📦 MOD-08: Timetable & Academic Calendar
│   ├── Weekly Timetable per Class
│   ├── Academic Year Timeline
│   ├── Term / Semester Dates
│   └── Event Management
│
├── 📦 MOD-09: Resources & Learning
│   ├── Document Library (PDFs, notes)
│   ├── Subject-wise Resource Categorization
│   └── Student Access Portal
│
├── 📦 MOD-10: Reporting & Analytics
│   ├── Pass/Fail Reports
│   ├── Class Rankings
│   ├── Subject Rankings
│   ├── School-wide Best Students
│   └── Custom Report Builder
│
├── 📦 MOD-11: Import / Export
│   ├── Excel Import (students, teachers, grades)
│   ├── PDF Export (transcripts, reports)
│   └── Data Backup & Restore
│
└── 📦 MOD-12: Notifications
    ├── In-App Alerts
    ├── SMS Gateway (optional)
    └── Announcement Board
```

---

## 4. Entity-Relationship Diagram (ERD)

```
┌──────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    ENTITY RELATIONSHIP DIAGRAM                                 │
└──────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────┐         ┌─────────────────────┐         ┌────────────────────┐
│   SCHOOL    │────1:N──►│    ACADEMIC_YEAR     │────1:N──►│       TERM         │
│─────────────│         │─────────────────────│         │────────────────────│
│ id (PK)     │         │ id (PK)             │         │ id (PK)            │
│ name        │         │ school_id (FK)      │         │ academic_year_id   │
│ logo_url    │         │ label               │         │ label              │
│ address     │         │ start_date          │         │ start_date         │
│ phone       │         │ end_date            │         │ end_date           │
│ motto       │         │ is_current          │         │ term_number        │
│ created_at  │         └─────────────────────┘         └────────────────────┘
└──────┬──────┘
       │1
       │
       │N
┌──────▼──────┐         ┌─────────────────────┐         ┌────────────────────┐
│CLASS_LEVEL  │────1:N──►│   CLASSROOM         │────1:N──►│  CLASS_ENROLLMENT  │
│─────────────│         │─────────────────────│         │────────────────────│
│ id (PK)     │         │ id (PK)             │         │ id (PK)            │
│ school_id   │         │ class_level_id (FK) │         │ classroom_id (FK)  │
│ name        │         │ academic_year_id(FK)│         │ student_id (FK)    │
│ description │         │ section             │         │ enrollment_date    │
│ order_index │         │ room_number         │         │ is_active          │
│ fee_amount  │         │ capacity            │         └────────────────────┘
└──────┬──────┘         └──────────┬──────────┘
       │                           │
       │                           │N
       │                    ┌──────▼──────────────┐
       │                    │  CLASS_SUBJECT       │◄──────────────┐
       │                    │─────────────────────│               │
       │                    │ id (PK)             │               │
       │                    │ classroom_id (FK)   │               │
       │                    │ subject_id (FK)     │               │
       │                    │ teacher_id (FK)     │               │
       │                    │ coefficient         │               │
       │                    │ hours_per_week      │               │
       │                    └──────────┬──────────┘               │
       │                               │N                         │
       │                    ┌──────────▼──────────┐               │
       │                    │     SUBJECT          │               │
       │                    │─────────────────────│               │
       │                    │ id (PK)             │               │
       │                    │ school_id (FK)      │               │
       │                    │ name                │               │
       │                    │ code                │               │
       │                    │ category            │               │
       │                    └─────────────────────┘               │
       │                                                          │
┌──────▼──────────────────────────┐      ┌────────────────────────┴──────┐
│           STUDENT               │      │           TEACHER              │
│─────────────────────────────────│      │───────────────────────────────│
│ id (PK)                         │      │ id (PK)                       │
│ user_id (FK)                    │      │ user_id (FK)                  │
│ school_id (FK)                  │      │ school_id (FK)                │
│ first_name                      │      │ first_name                    │
│ last_name                       │      │ last_name                     │
│ date_of_birth                   │      │ date_of_birth                 │
│ gender                          │      │ gender                        │
│ address                         │      │ address                       │
│ phone                           │      │ phone                         │
│ email                           │      │ email                         │
│ student_code (unique)           │      │ employee_code (unique)        │
│ profile_photo_url               │      │ profile_photo_url             │
│ nationality                     │      │ hire_date                     │
│ status [active|graduated|trans] │      │ years_of_experience           │
│ created_at                      │      │ qualification                 │
│ updated_at                      │      │ status [active|on_leave|term] │
└──────┬──────────────────────────┘      │ created_at                    │
       │1                                └──────────┬────────────────────┘
       │                                            │1
       │N                                           │N
┌──────▼──────────────────────────┐      ┌──────────▼────────────────────┐
│         STUDENT_PARENT          │      │       TEACHER_FAMILY           │
│─────────────────────────────────│      │───────────────────────────────│
│ id (PK)                         │      │ id (PK)                       │
│ student_id (FK)                  │      │ teacher_id (FK)               │
│ first_name                      │      │ relation [spouse|child|parent]│
│ last_name                       │      │ first_name                    │
│ relation [father|mother|tutor]  │      │ last_name                     │
│ phone                           │      │ date_of_birth                 │
│ email                           │      │ phone                         │
│ address                         │      └───────────────────────────────┘
│ occupation                      │
│ is_emergency_contact            │      ┌───────────────────────────────┐
└─────────────────────────────────┘      │         SALARY                │
                                         │───────────────────────────────│
                                         │ id (PK)                       │
                                         │ teacher_id (FK)               │
                                         │ amount                        │
                                         │ effective_date                │
                                         │ payment_date                  │
                                         │ payment_method                │
                                         │ status [paid|pending|partial] │
                                         │ notes                         │
                                         └───────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                         GRADES & TRANSCRIPT CLUSTER                       │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐      ┌──────────────────────┐      ┌────────────────────────┐
│     TRANSCRIPT      │──1:N─►│   TRANSCRIPT_LINE    │──N:1─►│    CLASS_SUBJECT       │
│─────────────────────│      │──────────────────────│      │ (see above)            │
│ id (PK)             │      │ id (PK)              │      └────────────────────────┘
│ student_id (FK)     │      │ transcript_id (FK)   │
│ classroom_id (FK)   │      │ class_subject_id(FK) │      ┌────────────────────────┐
│ term_id (FK)        │      │ grade_value          │      │  GRADE_ENTRY           │
│ academic_year_id(FK)│      │ max_grade (20)       │──────►│────────────────────────│
│ overall_average     │      │ coefficient          │      │ id (PK)                │
│ appreciation        │      │ weighted_score       │      │ transcript_line_id (FK)│
│ rank_in_class       │      │ appreciation         │      │ teacher_id (FK)        │
│ is_passed           │      │ absence_hours        │      │ entry_date             │
│ is_finalized        │      └──────────────────────┘      │ is_validated           │
│ digital_signature   │                                     └────────────────────────┘
│ signed_by (FK)      │
│ signed_at           │
│ generated_at        │
└─────────────────────┘

┌──────────────────────────────────────────────────────────────────────────┐
│                              FINANCE CLUSTER                               │
└──────────────────────────────────────────────────────────────────────────┘

┌─────────────────────┐      ┌──────────────────────┐
│   FEE_SCHEDULE      │──1:N─►│    FEE_PAYMENT        │
│─────────────────────│      │──────────────────────│
│ id (PK)             │      │ id (PK)              │
│ class_level_id (FK) │      │ student_id (FK)      │
│ academic_year_id(FK)│      │ fee_schedule_id (FK) │
│ total_amount        │      │ amount_paid          │
│ description         │      │ payment_date         │
│ due_date            │      │ receipt_number       │
│ installments_allowed│      │ payment_method       │
└─────────────────────┘      │ recorded_by (FK)     │
                              │ notes                │
                              └──────────────────────┘
```

---

## 5. Class Diagrams by Module

### 5.1 Core / School Configuration Module

```
┌──────────────────────────────────────────────────────┐
│                      <<entity>>                       │
│                       School                          │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - name: String                                        │
│ - short_name: String                                  │
│ - logo_url: String                                    │
│ - address: String                                     │
│ - city: String                                        │
│ - country: String                                     │
│ - phone: String                                       │
│ - email: String                                       │
│ - motto: String                                       │
│ - ministry_code: String                               │
│ - school_type: Enum[public, private, mission]         │
│ - default_language: Enum[fr, ar, en]                  │
│ - created_at: DateTime                                │
├──────────────────────────────────────────────────────┤
│ + getActiveAcademicYear(): AcademicYear               │
│ + getClassLevels(): List<ClassLevel>                  │
│ + configure(settings: SchoolSettings): void           │
└──────────────────────────────────────────────────────┘
                           │1
                           │ has
                           │N
┌──────────────────────────▼───────────────────────────┐
│                      <<entity>>                       │
│                    AcademicYear                       │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - school_id: UUID                                     │
│ - label: String               (e.g. "2024-2025")     │
│ - start_date: Date                                    │
│ - end_date: Date                                      │
│ - is_current: Boolean                                 │
│ - grading_system: Enum[term, semester]                │
├──────────────────────────────────────────────────────┤
│ + getTerms(): List<Term>                              │
│ + isActive(): Boolean                                 │
└──────────────────────────────────────────────────────┘
                           │1
                           │ divided into
                           │N
┌──────────────────────────▼───────────────────────────┐
│                      <<entity>>                       │
│                        Term                           │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - academic_year_id: UUID                              │
│ - label: String               (e.g. "Trimestre 1")   │
│ - term_number: Integer                                │
│ - start_date: Date                                    │
│ - end_date: Date                                      │
│ - is_current: Boolean                                 │
│ - exam_start_date: Date                               │
│ - exam_end_date: Date                                 │
├──────────────────────────────────────────────────────┤
│ + isActive(): Boolean                                 │
│ + getDurationWeeks(): Integer                         │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                      <<entity>>                       │
│                     ClassLevel                        │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - school_id: UUID                                     │
│ - name: String                (e.g. "Terminale", "3e")│
│ - code: String                (e.g. "TLE", "3EME")   │
│ - order_index: Integer        (for sorting)           │
│ - description: String                                 │
│ - is_exam_year: Boolean       (national exam year?)   │
├──────────────────────────────────────────────────────┤
│ + getClassrooms(yearId): List<Classroom>              │
│ + getFeeSchedule(yearId): FeeSchedule                 │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                   <<service>>                         │
│               SchoolConfigService                     │
├──────────────────────────────────────────────────────┤
│ + setupSchool(data: SchoolSetupDto): School           │
│ + uploadLogo(file: File): String                      │
│ + createAcademicYear(data): AcademicYear              │
│ + createClassLevel(data): ClassLevel                  │
│ + setCurrentYear(yearId): void                        │
└──────────────────────────────────────────────────────┘
```

---

### 5.2 User & Authentication Module

```
┌──────────────────────────────────────────────────────┐
│                      <<entity>>                       │
│                        User                           │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - school_id: UUID                                     │
│ - username: String            (unique per school)     │
│ - password_hash: String                               │
│ - role: Enum[school_master, teacher, student]         │
│ - is_active: Boolean                                  │
│ - last_login: DateTime                                │
│ - created_at: DateTime                                │
│ - digital_signature_cert: String (base64 / cert path)│
├──────────────────────────────────────────────────────┤
│ + authenticate(password): Boolean                     │
│ + generateToken(): String                             │
│ + hasPermission(permission): Boolean                  │
│ + sign(document: Document): DigitalSignature          │
└──────────────────────────────────────────────────────┘
         △                  △                  △
         │                  │                  │
         │ extends           │ extends           │ extends
┌────────┴──────┐  ┌────────┴──────┐  ┌────────┴──────┐
│ SchoolMaster  │  │  TeacherUser  │  │  StudentUser  │
│ User          │  │               │  │               │
├───────────────┤  ├───────────────┤  ├───────────────┤
│(full access)  │  │(class access) │  │(self access)  │
└───────────────┘  └───────────────┘  └───────────────┘

┌──────────────────────────────────────────────────────┐
│                   <<service>>                         │
│                  AuthService                          │
├──────────────────────────────────────────────────────┤
│ + login(username, password): AuthToken                │
│ + logout(token): void                                 │
│ + refreshToken(token): AuthToken                      │
│ + resetPassword(userId, newPwd): void                 │
│ + createUser(data, role): User                        │
│ + generateDigitalCertificate(userId): Certificate     │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                   <<value object>>                    │
│                   DigitalSignature                    │
├──────────────────────────────────────────────────────┤
│ - signer_id: UUID                                     │
│ - signer_role: String                                 │
│ - signed_at: DateTime                                 │
│ - signature_hash: String                              │
│ - certificate: String                                 │
├──────────────────────────────────────────────────────┤
│ + verify(): Boolean                                   │
│ + toString(): String                                  │
└──────────────────────────────────────────────────────┘
```

---

### 5.3 Student Module

```
┌──────────────────────────────────────────────────────┐
│                      <<entity>>                       │
│                       Student                         │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - user_id: UUID                                       │
│ - school_id: UUID                                     │
│ - student_code: String        (auto-generated unique) │
│ - first_name: String                                  │
│ - last_name: String                                   │
│ - date_of_birth: Date                                 │
│ - gender: Enum[male, female]                          │
│ - address: String                                     │
│ - phone: String                                       │
│ - email: String                                       │
│ - nationality: String                                 │
│ - profile_photo_url: String                           │
│ - status: Enum[active, graduated, transferred, drop]  │
│ - enrollment_date: Date                               │
│ - created_at: DateTime                                │
├──────────────────────────────────────────────────────┤
│ + getFullName(): String                               │
│ + getCurrentClass(): Classroom                        │
│ + getTranscripts(): List<Transcript>                  │
│ + getFeeStatus(): FeeStatus                           │
│ + getParents(): List<Parent>                          │
└──────────────────────────────────────────────────────┘
                     │1
                     │ has
                     │N
┌────────────────────▼─────────────────────────────────┐
│                      <<entity>>                       │
│                        Parent                         │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - student_id: UUID                                    │
│ - relation: Enum[father, mother, guardian, tutor]     │
│ - first_name: String                                  │
│ - last_name: String                                   │
│ - phone: String                                       │
│ - email: String                                       │
│ - address: String                                     │
│ - occupation: String                                  │
│ - is_emergency_contact: Boolean                       │
├──────────────────────────────────────────────────────┤
│ + getContactInfo(): ContactInfo                       │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                      <<entity>>                       │
│                   ClassEnrollment                     │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - student_id: UUID                                    │
│ - classroom_id: UUID                                  │
│ - academic_year_id: UUID                              │
│ - enrollment_date: Date                               │
│ - is_active: Boolean                                  │
│ - transfer_reason: String                             │
├──────────────────────────────────────────────────────┤
│ + getClassroom(): Classroom                           │
│ + getStudent(): Student                               │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                   <<service>>                         │
│                 StudentService                        │
├──────────────────────────────────────────────────────┤
│ + createStudent(data: StudentDto): Student            │
│ + updateStudent(id, data): Student                    │
│ + enrollInClass(studentId, classroomId): Enrollment   │
│ + transferStudent(studentId, newClassId): void        │
│ + getStudentProfile(studentId): StudentProfile        │
│ + searchStudents(query): List<Student>                │
│ + importFromExcel(file): ImportResult                 │
│ + getPassedStudents(classId, termId): List<Student>   │
│ + getFailedStudents(classId, termId): List<Student>   │
└──────────────────────────────────────────────────────┘
```

---

### 5.4 Teacher Module

```
┌──────────────────────────────────────────────────────┐
│                      <<entity>>                       │
│                       Teacher                         │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - user_id: UUID                                       │
│ - school_id: UUID                                     │
│ - employee_code: String       (auto-generated unique) │
│ - first_name: String                                  │
│ - last_name: String                                   │
│ - date_of_birth: Date                                 │
│ - gender: Enum[male, female]                          │
│ - address: String                                     │
│ - phone: String                                       │
│ - email: String                                       │
│ - nationality: String                                 │
│ - qualification: String       (highest degree)        │
│ - specialization: String                              │
│ - hire_date: Date                                     │
│ - profile_photo_url: String                           │
│ - status: Enum[active, on_leave, terminated]          │
│ - created_at: DateTime                                │
├──────────────────────────────────────────────────────┤
│ + getFullName(): String                               │
│ + getYearsOfService(): Integer                        │
│ + getAssignedClasses(): List<Classroom>               │
│ + getAssignedSubjects(): List<Subject>                │
│ + getSalaryHistory(): List<Salary>                    │
│ + getFamilyMembers(): List<FamilyMember>              │
└──────────────────────────────────────────────────────┘
                     │1
            ┌────────┴──────────────────┐
            │N                          │N
┌───────────▼───────────┐   ┌───────────▼──────────────┐
│   <<entity>>           │   │   <<entity>>              │
│   FamilyMember        │   │       Salary              │
├───────────────────────┤   ├──────────────────────────┤
│ - id: UUID            │   │ - id: UUID               │
│ - teacher_id: UUID    │   │ - teacher_id: UUID       │
│ - relation: Enum      │   │ - gross_amount: Decimal  │
│   [spouse,child,      │   │ - net_amount: Decimal    │
│    parent, sibling]   │   │ - deductions: Decimal    │
│ - first_name: String  │   │ - pay_period: String     │
│ - last_name: String   │   │   (e.g. "Janvier 2025") │
│ - date_of_birth: Date │   │ - payment_date: Date     │
│ - phone: String       │   │ - payment_method: Enum   │
├───────────────────────┤   │ - status: Enum           │
│ + getAge(): Integer   │   │   [paid,pending,partial] │
└───────────────────────┘   │ - notes: String          │
                             ├──────────────────────────┤
                             │ + computeNet(): Decimal  │
                             └──────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                   <<service>>                         │
│                 TeacherService                        │
├──────────────────────────────────────────────────────┤
│ + createTeacher(data: TeacherDto): Teacher            │
│ + updateTeacher(id, data): Teacher                    │
│ + assignToClass(teacherId, classSubjectId): void      │
│ + recordSalary(teacherId, data): Salary               │
│ + getSalaryHistory(teacherId): List<Salary>           │
│ + getTeacherWorkload(teacherId): WorkloadReport       │
│ + importFromExcel(file): ImportResult                 │
└──────────────────────────────────────────────────────┘
```

---

### 5.5 Class & Curriculum Module

```
┌──────────────────────────────────────────────────────┐
│                      <<entity>>                       │
│                      Classroom                        │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - class_level_id: UUID                                │
│ - academic_year_id: UUID                              │
│ - section: String             (e.g. "A", "B")        │
│ - room_number: String                                 │
│ - capacity: Integer                                   │
│ - head_teacher_id: UUID       (nullable)              │
├──────────────────────────────────────────────────────┤
│ + getFullName(): String       ("Terminale A")        │
│ + getStudents(): List<Student>                        │
│ + getSubjects(): List<ClassSubject>                   │
│ + getStudentCount(): Integer                          │
│ + getTimetable(): Timetable                           │
└──────────────────────────────────────────────────────┘
                     │1
                     │ contains
                     │N
┌────────────────────▼─────────────────────────────────┐
│                      <<entity>>                       │
│                     ClassSubject                      │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - classroom_id: UUID                                  │
│ - subject_id: UUID                                    │
│ - teacher_id: UUID                                    │
│ - coefficient: Integer        (preset, e.g. 4)       │
│ - hours_per_week: Decimal                             │
│ - is_optional: Boolean                                │
├──────────────────────────────────────────────────────┤
│ + getSubject(): Subject                               │
│ + getTeacher(): Teacher                               │
│ + getCoefficient(): Integer                           │
└──────────────────────────────────────────────────────┘
                     │N
                     │ is a
                     │1
┌────────────────────▼─────────────────────────────────┐
│                      <<entity>>                       │
│                       Subject                         │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - school_id: UUID                                     │
│ - name: String                (e.g. "Mathématiques") │
│ - code: String                (e.g. "MATH")          │
│ - category: Enum              [science, literature,  │
│                                humanities, tech, art]│
│ - default_coefficient: Integer                        │
│ - description: String                                 │
├──────────────────────────────────────────────────────┤
│ + getDefaultCoefficient(): Integer                    │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                   <<service>>                         │
│               CurriculumService                       │
├──────────────────────────────────────────────────────┤
│ + createSubject(data): Subject                        │
│ + createClassroom(data): Classroom                    │
│ + assignSubjectToClass(data): ClassSubject            │
│ + assignTeacherToSubject(teacherId, csId): void       │
│ + setCoefficient(classSubjectId, coeff): void         │
│ + getClassroomRoster(classroomId): List<Student>      │
│ + importCurriculumFromExcel(file): ImportResult       │
└──────────────────────────────────────────────────────┘
```

---

### 5.6 Grades & Transcript Module

```
┌──────────────────────────────────────────────────────┐
│                      <<entity>>                       │
│                      Transcript                       │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - student_id: UUID                                    │
│ - classroom_id: UUID                                  │
│ - term_id: UUID                                       │
│ - academic_year_id: UUID                              │
│ - overall_average: Decimal    (computed, /20)         │
│ - appreciation: String        (computed from average) │
│ - rank_in_class: Integer      (computed)              │
│ - total_coefficient: Integer  (computed)              │
│ - total_weighted_score: Decimal (computed)            │
│ - is_passed: Boolean          (avg >= 10 → passed)    │
│ - is_finalized: Boolean                               │
│ - digital_signature: JSON     (signature object)      │
│ - signed_by: UUID             (school master user)    │
│ - signed_at: DateTime                                 │
│ - generated_at: DateTime                              │
├──────────────────────────────────────────────────────┤
│ + computeAverage(): Decimal                           │
│ + computeAppreciation(): String                       │
│ + computeRank(): Integer                              │
│ + finalize(): void                                    │
│ + sign(masterUser: User): DigitalSignature            │
│ + exportToPDF(): File                                 │
└──────────────────────────────────────────────────────┘
                     │1
                     │ contains
                     │N
┌────────────────────▼─────────────────────────────────┐
│                      <<entity>>                       │
│                   TranscriptLine                      │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - transcript_id: UUID                                 │
│ - class_subject_id: UUID                              │
│ - grade_value: Decimal        (0.00 – 20.00)         │
│ - max_grade: Decimal          (always 20)            │
│ - coefficient: Integer        (copied from ClassSubject)│
│ - weighted_score: Decimal     (computed: grade × coeff)│
│ - appreciation: String        (computed from grade)   │
│ - absence_hours: Integer                              │
│ - teacher_comment: String                             │
│ - entered_by: UUID            (teacher user id)       │
│ - entered_at: DateTime                                │
│ - is_validated: Boolean                               │
├──────────────────────────────────────────────────────┤
│ + computeWeightedScore(): Decimal                     │
│ + computeAppreciation(): String                       │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                   <<value object>>                    │
│              AppreciationScale (static)               │
├──────────────────────────────────────────────────────┤
│ EXCELLENT   : 18.00 – 20.00                           │
│ TRES_BIEN   : 16.00 – 17.99                           │
│ BIEN        : 14.00 – 15.99                           │
│ ASSEZ_BIEN  : 12.00 – 13.99                           │
│ PASSABLE    : 10.00 – 11.99                           │
│ INSUFFISANT :  8.00 –  9.99                           │
│ FAIBLE      :  6.00 –  7.99                           │
│ TRES_FAIBLE :  0.00 –  5.99                           │
├──────────────────────────────────────────────────────┤
│ + getAppreciation(grade: Decimal): String             │
│ + isPassed(average: Decimal): Boolean  (>= 10)        │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                   <<service>>                         │
│               TranscriptService                       │
├──────────────────────────────────────────────────────┤
│ + initializeTranscripts(classroomId, termId): void   │
│ + enterGrade(lineId, grade, teacherId): TranscriptLine│
│ + validateGrade(lineId, teacherId): void              │
│ + computeTranscript(transcriptId): Transcript         │
│ + computeClassRanks(classroomId, termId): void       │
│ + finalizeTranscript(transcriptId): void              │
│ + signTranscript(transcriptId, masterId): Transcript  │
│ + generatePDF(transcriptId): File                     │
│ + bulkGeneratePDFs(classroomId, termId): ZipFile      │
│ + getClassResults(classroomId, termId): ClassResults  │
│ + getBestStudents(scope, termId): List<Student>       │
│ + getPassedStudents(classroomId, termId): List<Student>│
│ + getFailedStudents(classroomId, termId): List<Student>│
│ + getSubjectBest(subjectId, termId): Student          │
└──────────────────────────────────────────────────────┘
```

---

### 5.7 Finance Module

```
┌──────────────────────────────────────────────────────┐
│                      <<entity>>                       │
│                     FeeSchedule                       │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - class_level_id: UUID                                │
│ - academic_year_id: UUID                              │
│ - total_amount: Decimal                               │
│ - currency: String            (default: "XAF")       │
│ - description: String                                 │
│ - due_date: Date                                      │
│ - installments_allowed: Boolean                       │
│ - max_installments: Integer                           │
├──────────────────────────────────────────────────────┤
│ + getInstallmentAmount(): Decimal                     │
└──────────────────────────────────────────────────────┘
                     │1
                     │ tracked via
                     │N
┌────────────────────▼─────────────────────────────────┐
│                      <<entity>>                       │
│                     FeePayment                        │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - student_id: UUID                                    │
│ - fee_schedule_id: UUID                               │
│ - amount_paid: Decimal                                │
│ - payment_date: Date                                  │
│ - receipt_number: String      (auto-generated)       │
│ - payment_method: Enum        [cash, mobile, bank]   │
│ - recorded_by: UUID           (user who recorded)    │
│ - notes: String                                       │
│ - is_validated: Boolean                               │
├──────────────────────────────────────────────────────┤
│ + generateReceipt(): Document                         │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                   <<value object>>                    │
│                     FeeStatus                         │
├──────────────────────────────────────────────────────┤
│ - student_id: UUID                                    │
│ - fee_schedule_id: UUID                               │
│ - total_due: Decimal                                  │
│ - total_paid: Decimal                                 │
│ - balance: Decimal                                    │
│ - status: Enum[fully_paid, partial, unpaid]           │
│ - last_payment_date: Date                             │
├──────────────────────────────────────────────────────┤
│ + isFullyPaid(): Boolean                              │
│ + getPercentagePaid(): Decimal                        │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                   <<service>>                         │
│                  FinanceService                       │
├──────────────────────────────────────────────────────┤
│ + createFeeSchedule(data): FeeSchedule                │
│ + recordPayment(data): FeePayment                     │
│ + getFeeStatus(studentId, yearId): FeeStatus          │
│ + getUnpaidStudents(classId, yearId): List<Student>   │
│ + generateFinancialReport(yearId): Report             │
│ + exportPaymentsToExcel(filters): File                │
└──────────────────────────────────────────────────────┘
```

---

### 5.8 Timetable & Academic Calendar Module

```
┌──────────────────────────────────────────────────────┐
│                      <<entity>>                       │
│                      Timetable                        │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - classroom_id: UUID                                  │
│ - academic_year_id: UUID                              │
│ - term_id: UUID                                       │
│ - created_at: DateTime                                │
│ - updated_at: DateTime                                │
│ - is_published: Boolean                               │
├──────────────────────────────────────────────────────┤
│ + getSlots(): List<TimetableSlot>                     │
│ + publish(): void                                     │
└──────────────────────────────────────────────────────┘
                     │1
                     │ has
                     │N
┌────────────────────▼─────────────────────────────────┐
│                      <<entity>>                       │
│                    TimetableSlot                      │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - timetable_id: UUID                                  │
│ - class_subject_id: UUID                              │
│ - day_of_week: Enum[Mon,Tue,Wed,Thu,Fri,Sat]         │
│ - start_time: Time                                    │
│ - end_time: Time                                      │
│ - room: String                                        │
├──────────────────────────────────────────────────────┤
│ + getDuration(): Integer      (minutes)               │
│ + overlaps(other: Slot): Boolean                      │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                      <<entity>>                       │
│                    AcademicEvent                      │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - school_id: UUID                                     │
│ - title: String                                       │
│ - description: String                                 │
│ - event_type: Enum[holiday, exam, meeting, other]     │
│ - start_date: DateTime                                │
│ - end_date: DateTime                                  │
│ - applies_to: Enum[all, class_level, classroom]       │
│ - target_id: UUID             (nullable, specific cls)│
│ - is_school_closed: Boolean                           │
├──────────────────────────────────────────────────────┤
│ + isOngoing(): Boolean                                │
│ + getAffectedClasses(): List<Classroom>               │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                   <<service>>                         │
│               TimetableService                        │
├──────────────────────────────────────────────────────┤
│ + createTimetable(classroomId, termId): Timetable     │
│ + addSlot(timetableId, slotData): TimetableSlot       │
│ + removeSlot(slotId): void                            │
│ + checkConflicts(slotData): List<Conflict>            │
│ + publishTimetable(timetableId): void                 │
│ + getStudentTimetable(studentId): Timetable           │
│ + getTeacherTimetable(teacherId): List<TimetableSlot> │
│ + createEvent(data): AcademicEvent                    │
│ + getAcademicCalendar(yearId): List<AcademicEvent>    │
└──────────────────────────────────────────────────────┘
```

---

### 5.9 Resources & Learning Module

```
┌──────────────────────────────────────────────────────┐
│                      <<entity>>                       │
│                    LearningResource                   │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - school_id: UUID                                     │
│ - title: String                                       │
│ - description: String                                 │
│ - resource_type: Enum[document, video, link, exam]   │
│ - file_url: String                                    │
│ - subject_id: UUID            (nullable)              │
│ - class_level_id: UUID        (nullable)              │
│ - uploaded_by: UUID           (teacher or master)     │
│ - is_public: Boolean          (visible to students?)  │
│ - tags: String[]                                      │
│ - download_count: Integer                             │
│ - created_at: DateTime                                │
├──────────────────────────────────────────────────────┤
│ + getFileSize(): String                               │
│ + isAccessibleBy(student: Student): Boolean           │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                   <<service>>                         │
│               ResourceService                         │
├──────────────────────────────────────────────────────┤
│ + uploadResource(file, metadata): LearningResource    │
│ + deleteResource(id): void                            │
│ + getResourcesBySubject(subjectId): List<Resource>    │
│ + getResourcesByLevel(levelId): List<Resource>        │
│ + searchResources(query): List<Resource>              │
│ + incrementDownload(resourceId): void                 │
│ + getStudentResources(studentId): List<Resource>      │
└──────────────────────────────────────────────────────┘
```

---

### 5.10 Reporting & Analytics Module

```
┌──────────────────────────────────────────────────────┐
│                   <<service>>                         │
│                 ReportingService                      │
├──────────────────────────────────────────────────────┤
│ + getSchoolSummary(yearId): SchoolSummaryReport       │
│ + getClassReport(classroomId, termId): ClassReport    │
│ + getStudentRanking(classroomId, termId): RankingList │
│ + getSubjectRanking(subjectId, termId): RankingList   │
│ + getSchoolBestStudents(yearId, n): List<Student>     │
│ + getCategoryStats(classId, termId): CategoryStats    │
│   (passed/failed counts, percentages)                 │
│ + getTeacherWorkloadReport(): WorkloadReport          │
│ + getFinancialSummary(yearId): FinancialReport        │
│ + exportReport(reportType, filters): File             │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                   <<value object>>                    │
│                    ClassReport                        │
├──────────────────────────────────────────────────────┤
│ - classroom: Classroom                                │
│ - term: Term                                          │
│ - total_students: Integer                             │
│ - passed_count: Integer                               │
│ - failed_count: Integer                               │
│ - pass_rate: Decimal           (percentage)           │
│ - class_average: Decimal                              │
│ - highest_average: Decimal                            │
│ - lowest_average: Decimal                             │
│ - best_student: Student                               │
│ - subject_averages: Map<Subject, Decimal>             │
│ - student_rankings: List<StudentRank>                 │
├──────────────────────────────────────────────────────┤
│ + exportToPDF(): File                                 │
│ + exportToExcel(): File                               │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                   <<value object>>                    │
│                    StudentRank                        │
├──────────────────────────────────────────────────────┤
│ - student: Student                                    │
│ - rank: Integer                                       │
│ - average: Decimal                                    │
│ - appreciation: String                                │
│ - is_passed: Boolean                                  │
└──────────────────────────────────────────────────────┘
```

---

### 5.11 Import / Export Module

```
┌──────────────────────────────────────────────────────┐
│                   <<service>>                         │
│                 ImportExportService                   │
├──────────────────────────────────────────────────────┤
│ + importStudentsFromExcel(file): ImportResult         │
│ + importTeachersFromExcel(file): ImportResult         │
│ + importGradesFromExcel(file, classId, termId)        │
│           : ImportResult                              │
│ + downloadStudentTemplate(): File                     │
│ + downloadTeacherTemplate(): File                     │
│ + downloadGradeTemplate(classId, termId): File        │
│ + exportStudentsToExcel(filters): File                │
│ + exportTranscriptsPDF(classId, termId): ZipFile      │
│ + exportReportToExcel(reportType, params): File       │
│ + backupDatabase(): File                              │
│ + restoreDatabase(file): RestoreResult                │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                   <<value object>>                    │
│                    ImportResult                       │
├──────────────────────────────────────────────────────┤
│ - total_rows: Integer                                 │
│ - imported: Integer                                   │
│ - skipped: Integer                                    │
│ - errors: List<ImportError>                           │
│ - created_at: DateTime                                │
├──────────────────────────────────────────────────────┤
│ + isSuccessful(): Boolean                             │
│ + getSummary(): String                                │
└──────────────────────────────────────────────────────┘
```

---

### 5.12 Notification Module

```
┌──────────────────────────────────────────────────────┐
│                      <<entity>>                       │
│                     Notification                      │
├──────────────────────────────────────────────────────┤
│ - id: UUID                                            │
│ - school_id: UUID                                     │
│ - title: String                                       │
│ - message: String                                     │
│ - notification_type: Enum[info, warning, alert]       │
│ - target_role: Enum[all, teachers, students, master]  │
│ - target_id: UUID             (specific user, null=all)│
│ - is_read: Boolean                                    │
│ - created_by: UUID                                    │
│ - created_at: DateTime                                │
│ - expires_at: DateTime                                │
├──────────────────────────────────────────────────────┤
│ + markAsRead(userId): void                            │
│ + isExpired(): Boolean                                │
└──────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────┐
│                   <<service>>                         │
│               NotificationService                     │
├──────────────────────────────────────────────────────┤
│ + sendToAll(schoolId, message): void                  │
│ + sendToRole(role, message): void                     │
│ + sendToUser(userId, message): void                   │
│ + getUnread(userId): List<Notification>               │
│ + markAllRead(userId): void                           │
│ + sendSMS(phone, message): void    (optional gateway) │
└──────────────────────────────────────────────────────┘
```

---

## 6. Relationship Summary

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                              RELATIONSHIP MATRIX                                          │
├─────────────────────┬──────────────────────┬──────────────┬──────────────────────────────┤
│ Entity A            │ Entity B             │ Cardinality  │ Description                  │
├─────────────────────┼──────────────────────┼──────────────┼──────────────────────────────┤
│ School              │ AcademicYear         │ 1 : N        │ A school has many years      │
│ School              │ ClassLevel           │ 1 : N        │ A school defines its levels  │
│ School              │ Subject              │ 1 : N        │ A school defines subjects    │
│ School              │ User                 │ 1 : N        │ A school has many users      │
│ AcademicYear        │ Term                 │ 1 : N        │ Year divided into terms      │
│ AcademicYear        │ Classroom            │ 1 : N        │ Classrooms per year          │
│ ClassLevel          │ Classroom            │ 1 : N        │ Many sections per level      │
│ ClassLevel          │ FeeSchedule          │ 1 : N        │ Fees set per level per year  │
│ Classroom           │ ClassSubject         │ 1 : N        │ Many subjects per class      │
│ Classroom           │ ClassEnrollment      │ 1 : N        │ Many students per class      │
│ Classroom           │ Timetable            │ 1 : 1        │ One timetable per class/term │
│ Subject             │ ClassSubject         │ 1 : N        │ Subject taught in many class │
│ Teacher             │ ClassSubject         │ 1 : N        │ Teacher teaches many courses │
│ Teacher             │ FamilyMember         │ 1 : N        │ Teacher has family members   │
│ Teacher             │ Salary               │ 1 : N        │ Teacher's salary history     │
│ Teacher             │ User                 │ 1 : 1        │ Teacher has one login        │
│ Student             │ User                 │ 1 : 1        │ Student has one login        │
│ Student             │ Parent               │ 1 : N        │ Student has 1-2 parents      │
│ Student             │ ClassEnrollment      │ 1 : N        │ Student can re-enroll yearly │
│ Student             │ Transcript           │ 1 : N        │ Transcript per student/term  │
│ Student             │ FeePayment           │ 1 : N        │ Student makes many payments  │
│ Transcript          │ TranscriptLine       │ 1 : N        │ One line per subject         │
│ ClassSubject        │ TranscriptLine       │ 1 : N        │ One grade entry per student  │
│ FeeSchedule         │ FeePayment           │ 1 : N        │ Many payments per schedule   │
│ Timetable           │ TimetableSlot        │ 1 : N        │ Many slots per timetable     │
│ LearningResource    │ Subject              │ N : 1        │ Resources linked to subject  │
│ LearningResource    │ ClassLevel           │ N : 1        │ Resources per level (opt.)   │
└─────────────────────┴──────────────────────┴──────────────┴──────────────────────────────┘
```

---

## 7. Use Case Diagrams

### 7.1 School Master Use Cases

```
                        ┌─────────────────────────────────────────────────────┐
                        │                  School Master                        │
                        │                                                       │
                        │  ┌──────────────────────────────────────────────┐   │
                        │  │  School Configuration                         │   │
                        │  │  ○ Configure school (name, logo, classes)    │   │
                        │  │  ○ Set up academic year & terms              │   │
                        │  │  ○ Define class levels and fee structure     │   │
                        │  │  ○ Create & manage users (teachers, students)│   │
                        │  └──────────────────────────────────────────────┘   │
                        │                                                       │
                        │  ┌──────────────────────────────────────────────┐   │
                        │  │  Data Management                              │   │
                        │  │  ○ Import students/teachers from Excel        │   │
                        │  │  ○ Assign teachers to subjects/classes        │   │
                        │  │  ○ Manage class rosters                      │   │
                        │  └──────────────────────────────────────────────┘   │
                        │                                                       │
                        │  ┌──────────────────────────────────────────────┐   │
                        │  │  Transcript & Grading                         │   │
                        │  │  ○ View all transcripts                      │   │
                        │  │  ○ Finalize & digitally sign transcripts     │   │
                        │  │  ○ Bulk export transcripts to PDF            │   │
                        │  └──────────────────────────────────────────────┘   │
                        │                                                       │
                        │  ┌──────────────────────────────────────────────┐   │
                        │  │  Reporting & Analytics                        │   │
                        │  │  ○ View pass/fail statistics                 │   │
                        │  │  ○ See best students (school/class/subject)  │   │
                        │  │  ○ View financial reports                    │   │
                        │  │  ○ Export reports                            │   │
                        │  └──────────────────────────────────────────────┘   │
                        │                                                       │
                        │  ┌──────────────────────────────────────────────┐   │
                        │  │  Finance                                       │   │
                        │  │  ○ Set fee schedules                         │   │
                        │  │  ○ Record & view payments                    │   │
                        │  │  ○ View unpaid students                      │   │
                        │  └──────────────────────────────────────────────┘   │
                        └─────────────────────────────────────────────────────┘

### 7.2 Teacher Use Cases

                        ┌─────────────────────────────────────────────────────┐
                        │                     Teacher                           │
                        │                                                       │
                        │  ┌──────────────────────────────────────────────┐   │
                        │  │  Grade Entry                                  │   │
                        │  │  ○ Enter grades for assigned classes/subjects │   │
                        │  │  ○ Add comments per student                  │   │
                        │  │  ○ Validate grade entries                    │   │
                        │  └──────────────────────────────────────────────┘   │
                        │                                                       │
                        │  ┌──────────────────────────────────────────────┐   │
                        │  │  Class Management                             │   │
                        │  │  ○ View class roster                         │   │
                        │  │  ○ View class timetable                      │   │
                        │  └──────────────────────────────────────────────┘   │
                        │                                                       │
                        │  ┌──────────────────────────────────────────────┐   │
                        │  │  Profile & Resources                          │   │
                        │  │  ○ View & update own profile                 │   │
                        │  │  ○ Upload learning resources                 │   │
                        │  └──────────────────────────────────────────────┘   │
                        └─────────────────────────────────────────────────────┘

### 7.3 Student Use Cases

                        ┌─────────────────────────────────────────────────────┐
                        │                     Student                           │
                        │                                                       │
                        │  ○ View own profile                                  │
                        │  ○ View own transcripts (by term/year)              │
                        │  ○ View class timetable                              │
                        │  ○ View academic calendar & events                  │
                        │  ○ View school fee status & payment history         │
                        │  ○ Access learning resources (by subject/level)     │
                        └─────────────────────────────────────────────────────┘
```

---

## 8. Sequence Diagrams

### 8.1 Grade Entry & Transcript Generation

```
Teacher          GradeUI           TranscriptService      Database         SchoolMaster
  │                │                      │                   │                │
  │──select class─►│                      │                   │                │
  │                │──getClassSubjects()─►│                   │                │
  │                │◄─return subjects─────│                   │                │
  │                │                      │                   │                │
  │──enter grade──►│                      │                   │                │
  │                │──enterGrade(lineId,  │                   │                │
  │                │   grade, teacherId)─►│                   │                │
  │                │                      │──save to DB──────►│                │
  │                │                      │◄─ confirmed ──────│                │
  │                │◄─grade saved ────────│                   │                │
  │                │                      │                   │                │
  │──validate────►│                      │                   │                │
  │                │──validateGrade()────►│                   │                │
  │                │                      │──update DB───────►│                │
  │                │◄─validated ──────────│                   │                │
  │                │                      │                   │                │
  │                │      [After all grades entered]          │                │
  │                │                      │                   │      ──────────│
  │                │                      │                   │      Master reviews
  │                │                      │──computeTranscript│                │
  │                │                      │  (transcriptId)──►│                │
  │                │                      │──computeAverage() │                │
  │                │                      │──computeRank()    │                │
  │                │                      │──save transcript─►│                │
  │                │                      │                   │                │
  │                │                      │──signTranscript()─┼───────────────►│
  │                │                      │                   │                │──apply sig
  │                │                      │◄──signed──────────┼────────────────│
  │                │                      │──generatePDF()    │                │
  │                │                      │──return PDF───────►                │
```

### 8.2 Student Import from Excel

```
SchoolMaster     ImportUI        ImportExportService      Validator        StudentService
     │               │                  │                     │                  │
     │──upload xlsx─►│                  │                     │                  │
     │               │──importStudents()►│                     │                  │
     │               │                  │──parseExcel()       │                  │
     │               │                  │──validateRows()────►│                  │
     │               │                  │◄─validation result──│                  │
     │               │                  │                     │                  │
     │               │                  │  [For each valid row]│                  │
     │               │                  │──createStudent()────►│                  │
     │               │                  │                     │──save student ──►│
     │               │                  │◄──student saved──────│                  │
     │               │                  │                     │                  │
     │               │──return ImportResult                   │                  │
     │               │  (imported: N, skipped: M, errors: [...])                │
     │◄──summary────►│                  │                     │                  │
```

---

## 9. State Diagrams

### 9.1 Transcript Lifecycle

```
                    ┌──────────┐
                    │          │
         ┌──────────┤ PENDING  ├──────────────────────────────┐
         │          │          │                               │
         │          └──────────┘                               │
         │               │                                     │
         │    All grades initialized                          │
         │               ▼                                     │
         │          ┌──────────┐                               │
         │          │          │                               │
         │  ◄────── │ IN_ENTRY │ ──── Teacher enters ──────── │
         │          │          │      and validates grades     │
         │          └──────────┘                               │
         │               │                                     │
         │    All lines validated                             │
         │               ▼                                     │
         │          ┌──────────┐                               │
         │          │COMPUTED  │  Averages & ranks             │
         │          │& RANKED  │  auto-computed                │
         │          └──────────┘                               │
         │               │                                     │
         │    Master reviews                                  │
         │               ▼                                     │
         │          ┌──────────┐                               │
         │          │FINALIZED │  Locked for edits            │
         │          └──────────┘                               │
         │               │                                     │
         │    Master digitally signs                         │
         │               ▼                                     │
         │          ┌──────────┐                               │
         └─────────►│  SIGNED  │  PDF ready for download     │
                    └──────────┘                               │
                                                              │
                              [If error detected]            │
                    ┌──────────┐                               │
                    │REOPENED  │ ◄─────────────────────────── ┘
                    └──────────┘
```

### 9.2 Student Enrollment Status

```
    [New Enrollment]
          │
          ▼
    ┌───────────┐         Transfer/Promotion     ┌────────────┐
    │  ACTIVE   │ ────────────────────────────►  │ TRANSFERRED│
    └───────────┘                                └────────────┘
          │
          │ End of final year
          ▼
    ┌───────────┐
    │ GRADUATED │
    └───────────┘
          │
          │ Abandonment
          ▼
    ┌───────────┐
    │  DROPPED  │
    └───────────┘
```

---

## 10. Database Schema Overview

```sql
-- Core Tables (simplified DDL)

school (id, name, short_name, logo_url, address, city, country, phone, email,
        motto, ministry_code, school_type, default_language, created_at)

academic_year (id, school_id, label, start_date, end_date, is_current, grading_system)

term (id, academic_year_id, label, term_number, start_date, end_date, is_current,
      exam_start_date, exam_end_date)

class_level (id, school_id, name, code, order_index, description, is_exam_year)

classroom (id, class_level_id, academic_year_id, section, room_number, capacity,
           head_teacher_id)

subject (id, school_id, name, code, category, default_coefficient, description)

class_subject (id, classroom_id, subject_id, teacher_id, coefficient,
               hours_per_week, is_optional)

-- User & Auth

user (id, school_id, username, password_hash, role, is_active, last_login,
      created_at, digital_signature_cert)

-- Student Tables

student (id, user_id, school_id, student_code, first_name, last_name,
         date_of_birth, gender, address, phone, email, nationality,
         profile_photo_url, status, enrollment_date, created_at, updated_at)

parent (id, student_id, relation, first_name, last_name, phone, email,
        address, occupation, is_emergency_contact)

class_enrollment (id, student_id, classroom_id, academic_year_id,
                  enrollment_date, is_active, transfer_reason)

-- Teacher Tables

teacher (id, user_id, school_id, employee_code, first_name, last_name,
         date_of_birth, gender, address, phone, email, nationality,
         qualification, specialization, hire_date, profile_photo_url,
         status, created_at, updated_at)

family_member (id, teacher_id, relation, first_name, last_name,
               date_of_birth, phone)

salary (id, teacher_id, gross_amount, net_amount, deductions, pay_period,
        payment_date, payment_method, status, notes)

-- Grades & Transcripts

transcript (id, student_id, classroom_id, term_id, academic_year_id,
            overall_average, appreciation, rank_in_class, total_coefficient,
            total_weighted_score, is_passed, is_finalized, digital_signature,
            signed_by, signed_at, generated_at)

transcript_line (id, transcript_id, class_subject_id, grade_value, max_grade,
                 coefficient, weighted_score, appreciation, absence_hours,
                 teacher_comment, entered_by, entered_at, is_validated)

-- Finance

fee_schedule (id, class_level_id, academic_year_id, total_amount, currency,
              description, due_date, installments_allowed, max_installments)

fee_payment (id, student_id, fee_schedule_id, amount_paid, payment_date,
             receipt_number, payment_method, recorded_by, notes, is_validated)

-- Timetable

timetable (id, classroom_id, academic_year_id, term_id, created_at,
           updated_at, is_published)

timetable_slot (id, timetable_id, class_subject_id, day_of_week,
                start_time, end_time, room)

academic_event (id, school_id, title, description, event_type, start_date,
                end_date, applies_to, target_id, is_school_closed)

-- Resources

learning_resource (id, school_id, title, description, resource_type,
                   file_url, subject_id, class_level_id, uploaded_by,
                   is_public, tags, download_count, created_at)

-- Notifications

notification (id, school_id, title, message, notification_type, target_role,
              target_id, is_read, created_by, created_at, expires_at)

-- Indexes (critical)
CREATE INDEX idx_student_school      ON student(school_id);
CREATE INDEX idx_enrollment_year     ON class_enrollment(academic_year_id);
CREATE INDEX idx_transcript_student  ON transcript(student_id, term_id);
CREATE INDEX idx_transcript_class    ON transcript(classroom_id, term_id);
CREATE INDEX idx_grade_entry         ON transcript_line(transcript_id);
CREATE INDEX idx_fee_student         ON fee_payment(student_id);
```

---

## 11. System Roles & Permissions Matrix

```
┌────────────────────────────────────┬──────────────┬─────────────┬──────────────┐
│ Action / Feature                   │ SchoolMaster │   Teacher   │   Student    │
├────────────────────────────────────┼──────────────┼─────────────┼──────────────┤
│ Configure school settings          │      ✅      │     ❌      │      ❌      │
│ Create/edit academic year          │      ✅      │     ❌      │      ❌      │
│ Manage class levels                │      ✅      │     ❌      │      ❌      │
│ Create/edit students               │      ✅      │     ❌      │      ❌      │
│ Create/edit teachers               │      ✅      │     ❌      │      ❌      │
│ View all students                  │      ✅      │  Own class  │  Own only    │
│ View all teachers                  │      ✅      │     ❌      │      ❌      │
│ Assign teachers to subjects        │      ✅      │     ❌      │      ❌      │
│ Enter grades                       │      ✅      │  Own subj.  │      ❌      │
│ Validate grades                    │      ✅      │  Own subj.  │      ❌      │
│ Finalize transcripts               │      ✅      │     ❌      │      ❌      │
│ Sign transcripts (digital)         │      ✅      │     ❌      │      ❌      │
│ View transcripts                   │      ✅      │  Own class  │  Own only    │
│ Export transcripts PDF             │      ✅      │  Own class  │  Own only    │
│ Manage fee schedules               │      ✅      │     ❌      │      ❌      │
│ Record fee payments                │      ✅      │     ❌      │      ❌      │
│ View fee status                    │      ✅      │     ❌      │  Own only    │
│ Manage timetables                  │      ✅      │     ❌      │      ❌      │
│ View timetable                     │      ✅      │  Own class  │  Own class   │
│ Manage academic calendar           │      ✅      │     ❌      │  View only   │
│ Upload learning resources          │      ✅      │     ✅      │      ❌      │
│ Access learning resources          │      ✅      │     ✅      │      ✅      │
│ View analytics/reports             │      ✅      │  Own class  │      ❌      │
│ Import from Excel                  │      ✅      │     ❌      │      ❌      │
│ Export reports                     │      ✅      │  Own class  │      ❌      │
│ Backup/restore database            │      ✅      │     ❌      │      ❌      │
│ Send notifications                 │      ✅      │     ❌      │      ❌      │
│ View own profile                   │      ✅      │     ✅      │      ✅      │
│ Edit own profile                   │      ✅      │     ✅      │      ❌      │
└────────────────────────────────────┴──────────────┴─────────────┴──────────────┘
```

---

## 12. Scalability & Modularity Notes

### Multi-Tenant Architecture

Each `school_id` acts as a tenant boundary. All queries are scoped to the school, enabling future:

- **School Network / Federation**: A single deployment serving multiple schools under one administration.
- **SaaS Mode**: Cloud deployment where each school subscribes and has isolated data.

### Module Activation System

Each school can enable or disable modules via a `SchoolModuleConfig` table:

```
school_module_config (school_id, module_name, is_enabled, config_json)
```

Disabled modules are hidden from the UI. This keeps the system lightweight for schools that don't need all features.

### Extensibility Points

| Extension Point        | How to Extend                                       |
| ---------------------- | --------------------------------------------------- |
| New grading system     | Add new AppreciationScale or override per school    |
| New user role          | Add to Role enum + permission matrix                |
| New report type        | Implement new method in ReportingService            |
| New file import format | Add new parser in ImportExportService               |
| New subject category   | Extend Subject.category enum                        |
| New payment method     | Extend FeePayment.payment_method enum               |
| SMS providers          | Implement NotificationGateway interface             |
| Multiple languages     | i18n keys stored per school, override per UI string |

### Offline-First Sync Strategy

```
Desktop App (SQLite) ◄──► Sync Engine ◄──► Cloud DB (PostgreSQL)
                            │
                            ├── Conflict resolution: last-write-wins per record
                            ├── Queue offline mutations
                            └── Sync on reconnect
```

---

## 13. Technology Stack Recommendation

```
┌───────────────────────────────────────────────────────────────────────┐
│                     RECOMMENDED TECH STACK                             │
├──────────────────────┬────────────────────────────────────────────────┤
│ Layer                │ Technology                                      │
├──────────────────────┼────────────────────────────────────────────────┤
│ Desktop App Shell    │ Tauri (Rust + WebView) - lightweight, offline  │
│ Web Frontend         │ React + TypeScript + Tailwind CSS              │
│ State Management     │ Zustand or Redux Toolkit                       │
│ PDF Generation       │ React-PDF or Puppeteer (for transcripts)      │
│ Excel Import/Export  │ SheetJS (xlsx)                                 │
│ Local Database       │ SQLite via libsql / Turso                     │
│ Cloud Database       │ PostgreSQL (Supabase for easy hosting)        │
│ ORM                  │ Prisma or Drizzle ORM                         │
│ Backend API          │ Node.js + Express / Fastify OR                │
│                      │ Python + FastAPI (for easy African deployment) │
│ Authentication       │ JWT + bcrypt (self-hosted, no third-party dep) │
│ Digital Signatures   │ node-forge or Web Crypto API (RSA/ECDSA)     │
│ File Storage         │ Local filesystem (desktop) + S3 (cloud)       │
│ Sync Engine          │ CRDTs (Yjs) or custom queue-based sync        │
│ Notifications        │ In-app + optional Africa's Talking SMS API    │
│ i18n                 │ i18next (French primary, Arabic, English)     │
│ Build System         │ Vite + Tauri CLI                              │
│ Testing              │ Vitest (unit) + Playwright (e2e)              │
│ CI/CD                │ GitHub Actions                                │
└──────────────────────┴────────────────────────────────────────────────┘
```

---

## Document Information

| Field         | Value                                  |
| ------------- | -------------------------------------- |
| Project Name  | EduTrack Africa                        |
| Document Type | UML Architecture Design                |
| Version       | 1.0.0                                  |
| Target Region | Chad (primary) · Africa (scalable) │   |
| Language      | French (primary UI) · English (docs) │ |
| Author        | System Architect                       |
| Date          | May 2026                               |
| Status        | Initial Design - Ready for Development |

---

_This document is the complete UML and architecture foundation for EduTrack Africa. Each module is designed to be independently developed, tested, and deployed. The system scales from a single classroom to a nationwide school network._
