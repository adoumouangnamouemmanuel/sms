CREATE TABLE `class_level` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`display_order` integer NOT NULL,
	`is_exam_year` integer DEFAULT false NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `school_module_config` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`module_name` text NOT NULL,
	`is_enabled` integer DEFAULT false NOT NULL,
	`config_json` text DEFAULT '{}' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `term` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`academic_year_id` text NOT NULL,
	`label` text NOT NULL,
	`term_number` integer NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`is_current` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`academic_year_id`) REFERENCES `academic_year`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
DROP INDEX IF EXISTS `academic_year_school_label_unique`;--> statement-breakpoint
CREATE INDEX `class_level_school_id_idx` ON `class_level` (`school_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `class_level_school_code_unique` ON `class_level` (`school_id`,`code`) WHERE "class_level"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `class_level_school_name_unique` ON `class_level` (`school_id`,`name`) WHERE "class_level"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `class_level_school_order_unique` ON `class_level` (`school_id`,`display_order`) WHERE "class_level"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX `school_module_config_school_id_idx` ON `school_module_config` (`school_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `school_module_config_school_module_unique` ON `school_module_config` (`school_id`,`module_name`);--> statement-breakpoint
CREATE INDEX `term_school_id_idx` ON `term` (`school_id`);--> statement-breakpoint
CREATE INDEX `term_academic_year_id_idx` ON `term` (`academic_year_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `term_academic_year_current_unique` ON `term` (`academic_year_id`) WHERE "term"."is_current" = true;--> statement-breakpoint
CREATE UNIQUE INDEX `term_school_current_unique` ON `term` (`school_id`) WHERE "term"."is_current" = true;--> statement-breakpoint
CREATE UNIQUE INDEX `term_academic_year_label_unique` ON `term` (`academic_year_id`,`label`) WHERE "term"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `term_academic_year_number_unique` ON `term` (`academic_year_id`,`term_number`) WHERE "term"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `academic_year_school_current_unique` ON `academic_year` (`school_id`) WHERE "academic_year"."is_current" = true;--> statement-breakpoint
CREATE UNIQUE INDEX `academic_year_school_id_id_unique` ON `academic_year` (`school_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `academic_year_school_label_unique` ON `academic_year` (`school_id`,`label`) WHERE "academic_year"."deleted_at" is null;