-- Phase 3.4 follow-up: guardians are importable alongside students and
-- teachers, so the confirmed-import audit table must accept the new kind.
--
-- Rollback rationale: Irreversible. Rolling back would drop the GUARDIANS import 
-- batch history, violating audit retention requirements.
CREATE TABLE `import_batch_new` (
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
	CONSTRAINT `import_batch_kind_check` CHECK(`kind` in ('STUDENTS', 'TEACHERS', 'GUARDIANS')),
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO `import_batch_new` SELECT * FROM `import_batch`;
--> statement-breakpoint
DROP TABLE `import_batch`;
--> statement-breakpoint
ALTER TABLE `import_batch_new` RENAME TO `import_batch`;
--> statement-breakpoint
CREATE INDEX `import_batch_school_id_idx` ON `import_batch` (`school_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `import_batch_school_identifier_unique` ON `import_batch` (`school_id`,`import_identifier`);
--> statement-breakpoint
PRAGMA foreign_key_check;
