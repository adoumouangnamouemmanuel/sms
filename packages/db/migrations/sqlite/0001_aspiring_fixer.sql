PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_school` (
	`id` text PRIMARY KEY NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`short_name` text,
	`logo_url` text,
	`address` text,
	`city` text,
	`country` text DEFAULT 'TD' NOT NULL,
	`phone` text,
	`email` text,
	`motto` text,
	`ministry_code` text,
	`locale` text DEFAULT 'fr' NOT NULL,
	`timezone` text DEFAULT 'Africa/Ndjamena' NOT NULL,
	`currency` text DEFAULT 'XAF' NOT NULL,
	`setup_status` text DEFAULT 'PENDING' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text
);--> statement-breakpoint
INSERT INTO `__new_school` (
	`id`,
	`code`,
	`name`,
	`short_name`,
	`logo_url`,
	`address`,
	`phone`,
	`motto`,
	`created_at`,
	`updated_at`,
	`record_version`
)
SELECT
	`id`,
	lower(replace(`id`, '-', '')),
	`name`,
	`short_name`,
	`logo_url`,
	`address`,
	`phone`,
	`motto`,
	coalesce(`created_at`, CURRENT_TIMESTAMP),
	CURRENT_TIMESTAMP,
	1
FROM `school`;--> statement-breakpoint
DROP TABLE `school`;--> statement-breakpoint
ALTER TABLE `__new_school` RENAME TO `school`;--> statement-breakpoint
CREATE TABLE `__new_academic_year` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`label` text NOT NULL,
	`start_date` text,
	`end_date` text,
	`is_current` integer DEFAULT false NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);--> statement-breakpoint
INSERT INTO `__new_academic_year` (
	`id`,
	`school_id`,
	`label`,
	`start_date`,
	`end_date`,
	`is_current`,
	`created_at`,
	`updated_at`,
	`record_version`
)
SELECT
	`id`,
	`school_id`,
	`label`,
	`start_date`,
	`end_date`,
	coalesce(`is_current`, false),
	CURRENT_TIMESTAMP,
	CURRENT_TIMESTAMP,
	1
FROM `academic_year`;--> statement-breakpoint
DROP TABLE `academic_year`;--> statement-breakpoint
ALTER TABLE `__new_academic_year` RENAME TO `academic_year`;--> statement-breakpoint
CREATE TABLE `__new_user` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`username` text NOT NULL,
	`password_hash` text NOT NULL,
	`role` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`failed_login_attempts` integer DEFAULT 0 NOT NULL,
	`locked_until` text,
	`last_login_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `user_role_check` CHECK(`role` in ('SCHOOL_MASTER', 'TEACHER')),
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);--> statement-breakpoint
INSERT INTO `__new_user` (
	`id`,
	`school_id`,
	`username`,
	`password_hash`,
	`role`,
	`is_active`,
	`created_at`,
	`updated_at`,
	`record_version`
)
SELECT
	`id`,
	`school_id`,
	`username`,
	`password_hash`,
	CASE `role`
		WHEN 'school_master' THEN 'SCHOOL_MASTER'
		WHEN 'teacher' THEN 'TEACHER'
		ELSE NULL
	END,
	coalesce(`is_active`, true),
	coalesce(`created_at`, CURRENT_TIMESTAMP),
	CURRENT_TIMESTAMP,
	1
FROM `user`;--> statement-breakpoint
DROP TABLE `user`;--> statement-breakpoint
ALTER TABLE `__new_user` RENAME TO `user`;--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`actor_user_id` text,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text,
	`correlation_id` text,
	`metadata_json` text DEFAULT '{}' NOT NULL,
	`outcome` text DEFAULT 'SUCCESS' NOT NULL,
	`occurred_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	CONSTRAINT `audit_log_outcome_check` CHECK(`outcome` in ('SUCCESS', 'FAILURE')),
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE restrict
);--> statement-breakpoint
CREATE TABLE `refresh_session` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`family_id` text NOT NULL,
	`replaced_by_session_id` text,
	`device_name` text,
	`user_agent_hash` text,
	`expires_at` text NOT NULL,
	`revoked_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`replaced_by_session_id`) REFERENCES `refresh_session`(`id`) ON UPDATE cascade ON DELETE restrict
);--> statement-breakpoint
CREATE TABLE `schema_metadata` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`description` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL
);--> statement-breakpoint
CREATE INDEX `audit_log_school_id_idx` ON `audit_log` (`school_id`);--> statement-breakpoint
CREATE INDEX `audit_log_actor_user_id_idx` ON `audit_log` (`actor_user_id`);--> statement-breakpoint
CREATE INDEX `audit_log_target_idx` ON `audit_log` (`target_type`,`target_id`);--> statement-breakpoint
CREATE INDEX `refresh_session_school_id_idx` ON `refresh_session` (`school_id`);--> statement-breakpoint
CREATE INDEX `refresh_session_user_id_idx` ON `refresh_session` (`user_id`);--> statement-breakpoint
CREATE INDEX `refresh_session_family_id_idx` ON `refresh_session` (`family_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `refresh_session_token_hash_unique` ON `refresh_session` (`token_hash`);--> statement-breakpoint
CREATE INDEX `refresh_session_replaced_by_idx` ON `refresh_session` (`replaced_by_session_id`);--> statement-breakpoint
CREATE INDEX `academic_year_school_id_idx` ON `academic_year` (`school_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `academic_year_school_label_unique` ON `academic_year` (`school_id`,`label`);--> statement-breakpoint
CREATE UNIQUE INDEX `school_code_unique` ON `school` (`code`);--> statement-breakpoint
CREATE INDEX `user_school_id_idx` ON `user` (`school_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_school_username_unique` ON `user` (`school_id`,`username`);--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_key_check;
