# EduTrack Africa Database Schema

This document outlines the core database tables and their relationships for the EduTrack Africa system.

## Core Tables (Phase 0)

### 1. `school`
Stores the identity and configuration details of a school.

- **`id`**: UUID (Primary Key)
- **`name`**: VARCHAR(255), Not Null. The full name of the school.
- **`short_name`**: VARCHAR(50). An abbreviation for the school.
- **`logo_url`**: TEXT. Path/URL to the uploaded school logo.
- **`address`**: TEXT. Physical address.
- **`phone`**: VARCHAR(50). Contact phone number.
- **`motto`**: TEXT. School motto.
- **`created_at`**: TIMESTAMP. Defaults to now.

### 2. `academic_year`
Defines an academic year for a specific school.

- **`id`**: UUID (Primary Key)
- **`school_id`**: UUID, Not Null, Foreign Key to `school.id`.
- **`label`**: VARCHAR(50), Not Null. (e.g., "2024-2025")
- **`start_date`**: TIMESTAMP. Date the year officially begins.
- **`end_date`**: TIMESTAMP. Date the year ends.
- **`is_current`**: BOOLEAN. Defaults to false. Indicates the active year.

### 3. `user`
Represents an authenticated user (School Master, Teacher, Student, etc.).

- **`id`**: UUID (Primary Key)
- **`school_id`**: UUID, Not Null, Foreign Key to `school.id`. Tenant isolation boundary.
- **`username`**: VARCHAR(255), Not Null, Unique.
- **`password_hash`**: TEXT, Not Null. Bcrypt hash of the password.
- **`role`**: VARCHAR(50), Not Null. Allowed values: `school_master`, `teacher`, `student`.
- **`is_active`**: BOOLEAN. Defaults to true. Used for soft deletion/locking.
- **`created_at`**: TIMESTAMP. Defaults to now.
