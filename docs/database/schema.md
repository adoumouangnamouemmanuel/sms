# EduTrack Africa Database Schema

This document outlines the core database tables and their relationships for the EduTrack Africa system.

## Version 1 Storage

SQLite is the Version 1 system of record. PostgreSQL/cloud schemas are out of scope for the active Version 1 runtime and require a later ADR before implementation.

## Current Scaffold Tables

### 1. `school`

Stores the identity and configuration details of a school.

- **`id`**: UUID (Primary Key)
- **`name`**: TEXT, Not Null. The full name of the school.
- **`short_name`**: TEXT. An abbreviation for the school.
- **`logo_url`**: TEXT. Path/URL to the uploaded school logo.
- **`address`**: TEXT. Physical address.
- **`phone`**: TEXT. Contact phone number.
- **`motto`**: TEXT. School motto.
- **`created_at`**: TEXT timestamp. Defaults to current timestamp.

### 2. `academic_year`

Defines an academic year for a specific school.

- **`id`**: UUID (Primary Key)
- **`school_id`**: UUID, Not Null, Foreign Key to `school.id`.
- **`label`**: TEXT, Not Null. (e.g., "2024-2025")
- **`start_date`**: TEXT date. Date the year officially begins.
- **`end_date`**: TEXT date. Date the year ends.
- **`is_current`**: INTEGER boolean. Defaults to false. Indicates the active year.

### 3. `user`

Represents an authenticated user (School Master, Teacher, Student, etc.).

- **`id`**: UUID (Primary Key)
- **`school_id`**: UUID, Not Null, Foreign Key to `school.id`. Tenant isolation boundary.
- **`username`**: TEXT, Not Null, Unique.
- **`password_hash`**: TEXT, Not Null. Bcrypt hash of the password.
- **`role`**: TEXT, Not Null. Allowed values: `school_master`, `teacher`, `student`.
- **`is_active`**: INTEGER boolean. Defaults to true. Used for soft deletion/locking.
- **`created_at`**: TEXT timestamp. Defaults to current timestamp.

Phase 1.7.3 must replace this scaffold documentation with the approved schema conventions, migrations, repository primitives and seed policy.
