-- Phase 3.4: track confirmed imports so re-submitting the same import
-- identifier is a no-op and every import is auditable.
--
-- Rollback rationale: Irreversible. Dropping the import_batch table would 
-- destroy audit logs of completed imports, violating compliance requirements.
CREATE TABLE `import_batch` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`kind` text NOT NULL,
	`import_identifier` text NOT NULL,
	`filename` text NOT NULL,
	`total_rows` integer NOT NULL,
	`valid_rows` integer NOT NULL,
	`error_rows` integer NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `import_batch_kind_check` CHECK(`kind` in ('STUDENTS', 'TEACHERS')),
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `import_batch_school_id_idx` ON `import_batch` (`school_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_batch_school_identifier_unique` ON `import_batch` (`school_id`,`import_identifier`);
--> statement-breakpoint
PRAGMA foreign_key_check;
