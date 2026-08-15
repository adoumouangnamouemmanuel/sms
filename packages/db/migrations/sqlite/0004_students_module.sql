-- Phase 3.2: register the STUDENTS module.
-- Rebuilds school_module_config so the module_name CHECK accepts 'STUDENTS'
-- (SQLite cannot alter a CHECK constraint in place), preserving all rows and
-- indexes, then backfills the enabled STUDENTS row for every school that
-- lacks it so already-setup schools see the module too.
--
-- Rollback rationale: Irreversible. Rolling back would remove the STUDENTS module config 
-- and drop any data associated with it, which violates data retention rules.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_school_module_config` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`module_name` text NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `school_module_config_module_name_check` CHECK(`module_name` in ('SCHOOL_SETUP', 'ACADEMIC_STRUCTURE', 'STUDENTS')),
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);--> statement-breakpoint
INSERT INTO `__new_school_module_config` (
	`id`,
	`school_id`,
	`module_name`,
	`is_enabled`,
	`config_json`,
	`created_at`,
	`updated_at`,
	`record_version`,
	`deleted_at`
)
SELECT
	`id`,
	`school_id`,
	`module_name`,
	`is_enabled`,
	`config_json`,
	`created_at`,
	`updated_at`,
	`record_version`,
	`deleted_at`
FROM `school_module_config`;--> statement-breakpoint
DROP TABLE `school_module_config`;--> statement-breakpoint
ALTER TABLE `__new_school_module_config` RENAME TO `school_module_config`;--> statement-breakpoint
CREATE INDEX `school_module_config_school_id_idx` ON `school_module_config` (`school_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `school_module_config_school_module_unique` ON `school_module_config` (`school_id`,`module_name`);--> statement-breakpoint
INSERT INTO `school_module_config` (
	`id`,
	`school_id`,
	`module_name`,
	`is_enabled`,
	`config_json`,
	`created_at`,
	`updated_at`,
	`record_version`
)
SELECT
	lower(hex(randomblob(4)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(2)) || '-' || hex(randomblob(6))),
	`id`,
	'STUDENTS',
	true,
	'{}',
	CURRENT_TIMESTAMP,
	CURRENT_TIMESTAMP,
	1
FROM `school`
WHERE NOT EXISTS (
	SELECT 1
	FROM `school_module_config`
	WHERE `school_module_config`.`school_id` = `school`.`id`
		AND `school_module_config`.`module_name` = 'STUDENTS'
);--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_key_check;
