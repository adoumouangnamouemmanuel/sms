-- Phase 3.3: academic-year lifecycle DRAFT -> ACTIVE -> CLOSED (roadmap §9.3).
-- Adds the status column (existing rows become ACTIVE when they are the
-- school's current year, CLOSED otherwise) and a partial unique index that
-- guarantees exactly one ACTIVE year per school.
--
-- Rollback rationale: SQLite cannot drop a column or an index created via
-- ALTER in a rollback-safe way; the change is additive and preserves all
-- existing rows, so it is intentionally irreversible.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
ALTER TABLE `academic_year` ADD COLUMN `status` text DEFAULT 'ACTIVE' NOT NULL CHECK(`status` in ('DRAFT','ACTIVE','CLOSED'));--> statement-breakpoint
UPDATE `academic_year` SET `status` = 'CLOSED' WHERE `is_current` = 0 OR `deleted_at` IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `academic_year_school_active_unique` ON `academic_year` (`school_id`) WHERE `status` = 'ACTIVE' AND `deleted_at` is null;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_key_check;
