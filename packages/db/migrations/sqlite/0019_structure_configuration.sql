-- Phase 3.5/3.6: level curriculum matrix and school-defined subject groups.
--   level_subject          coefficient + required per subject per level
--   subject_group          school-defined groups (Littéraires, Scientifiques, ...)
--   subject_group_member   membership with display order
-- All rows are tenant-scoped; membership is validated by composite FKs.
--
-- Rollback rationale: Irreversible. Dropping the tables would remove
-- configuration history that later phases (bulletin sections, policy
-- inheritance) depend on.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `level_subject` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`class_level_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`coefficient` integer NOT NULL,
	`is_required` integer DEFAULT true NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `level_subject_coefficient_check` CHECK(`coefficient` >= 1),
	FOREIGN KEY (`school_id`,`class_level_id`) REFERENCES `class_level`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`subject_id`) REFERENCES `subject`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict
);--> statement-breakpoint
CREATE INDEX `level_subject_school_id_idx` ON `level_subject` (`school_id`);--> statement-breakpoint
CREATE INDEX `level_subject_class_level_id_idx` ON `level_subject` (`class_level_id`);--> statement-breakpoint
CREATE INDEX `level_subject_subject_id_idx` ON `level_subject` (`subject_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `level_subject_school_level_subject_unique` ON `level_subject` (`school_id`,`class_level_id`,`subject_id`) WHERE `deleted_at` is null;--> statement-breakpoint
CREATE UNIQUE INDEX `level_subject_school_id_id_unique` ON `level_subject` (`school_id`,`id`);--> statement-breakpoint
CREATE TABLE `subject_group` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`name` text NOT NULL,
	`name_en` text,
	`name_ar` text,
	`display_order` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `subject_group_display_order_check` CHECK(`display_order` >= 1),
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);--> statement-breakpoint
CREATE INDEX `subject_group_school_id_idx` ON `subject_group` (`school_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subject_group_school_name_unique` ON `subject_group` (`school_id`,`name`) WHERE `deleted_at` is null;--> statement-breakpoint
CREATE UNIQUE INDEX `subject_group_school_order_unique` ON `subject_group` (`school_id`,`display_order`) WHERE `deleted_at` is null;--> statement-breakpoint
CREATE UNIQUE INDEX `subject_group_school_id_id_unique` ON `subject_group` (`school_id`,`id`);--> statement-breakpoint
CREATE TABLE `subject_group_member` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`subject_group_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`display_order` integer NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `subject_group_member_display_order_check` CHECK(`display_order` >= 1),
	FOREIGN KEY (`school_id`,`subject_group_id`) REFERENCES `subject_group`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`subject_id`) REFERENCES `subject`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict
);--> statement-breakpoint
CREATE INDEX `subject_group_member_school_id_idx` ON `subject_group_member` (`school_id`);--> statement-breakpoint
CREATE INDEX `subject_group_member_group_id_idx` ON `subject_group_member` (`subject_group_id`);--> statement-breakpoint
CREATE INDEX `subject_group_member_subject_id_idx` ON `subject_group_member` (`subject_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subject_group_member_school_group_subject_unique` ON `subject_group_member` (`school_id`,`subject_group_id`,`subject_id`) WHERE `deleted_at` is null;--> statement-breakpoint
CREATE UNIQUE INDEX `subject_group_member_school_group_order_unique` ON `subject_group_member` (`school_id`,`subject_group_id`,`display_order`) WHERE `deleted_at` is null;--> statement-breakpoint
CREATE UNIQUE INDEX `subject_group_member_school_id_id_unique` ON `subject_group_member` (`school_id`,`id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_key_check;
