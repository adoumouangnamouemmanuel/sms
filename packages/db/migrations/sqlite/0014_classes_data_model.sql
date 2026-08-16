-- Re-issued as 0014 (was 0009_gifted_kronos): the original entry's journal
-- `when` timestamp was lower than already-applied migrations, so drizzle's
-- migrator permanently skipped it on databases that had already migrated past
-- 0007 (a fresh database applied everything in order and was unaffected). This
-- renumbering with a later `when` lets existing databases pick up the DDL.
--
-- Phase 4.1: classes and curriculum data model (roadmap §10.1).
-- Additive migration: five new tenant-scoped tables (subject, classroom,
-- class_subject, class_enrollment, student_subject_enrollment) with composite
-- tenant foreign keys, partial unique indexes and domain CHECK constraints.
-- No existing data is rewritten, so this is safe on non-empty databases.
--
-- Rollback rationale: Dropping these tables loses the school's curriculum and
-- enrolment data, which violates data retention rules. Reversible only on a
-- database that never wrote class data.
CREATE TABLE `class_enrollment` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`classroom_id` text NOT NULL,
	`academic_year_id` text NOT NULL,
	`status` text DEFAULT 'ACTIVE' NOT NULL,
	`enrollment_date` text NOT NULL,
	`exit_date` text,
	`reason` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `class_enrollment_status_check` CHECK(`status` in ('ACTIVE','TRANSFERRED','WITHDRAWN','GRADUATED','PROMOTED')),
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`student_id`) REFERENCES `student`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`classroom_id`) REFERENCES `classroom`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`academic_year_id`) REFERENCES `academic_year`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `class_subject` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`classroom_id` text NOT NULL,
	`subject_id` text NOT NULL,
	`coefficient` integer NOT NULL,
	`is_required` integer DEFAULT true NOT NULL,
	`teacher_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `class_subject_coefficient_check` CHECK(`coefficient` >= 1),
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`classroom_id`) REFERENCES `classroom`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`subject_id`) REFERENCES `subject`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`teacher_id`) REFERENCES `teacher`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `classroom` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`academic_year_id` text NOT NULL,
	`class_level_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text,
	`capacity` integer,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `classroom_capacity_check` CHECK(`capacity` is null or `capacity` >= 1),
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`academic_year_id`) REFERENCES `academic_year`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`class_level_id`) REFERENCES `class_level`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `student_subject_enrollment` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`class_enrollment_id` text NOT NULL,
	`class_subject_id` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`class_enrollment_id`) REFERENCES `class_enrollment`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`class_subject_id`) REFERENCES `class_subject`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `subject` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`code` text NOT NULL,
	`name` text NOT NULL,
	`name_en` text,
	`name_ar` text,
	`short_label` text,
	`category` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `subject_category_check` CHECK(`category` in ('LANGUES','SCIENCES','MATHEMATIQUES','SCIENCES_SOCIALES','ARTS','SPORTS','AUTRE')),
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `class_enrollment_school_id_idx` ON `class_enrollment` (`school_id`);--> statement-breakpoint
CREATE INDEX `class_enrollment_student_id_idx` ON `class_enrollment` (`student_id`);--> statement-breakpoint
CREATE INDEX `class_enrollment_classroom_id_idx` ON `class_enrollment` (`classroom_id`);--> statement-breakpoint
CREATE INDEX `class_enrollment_academic_year_id_idx` ON `class_enrollment` (`academic_year_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `class_enrollment_school_classroom_student_unique` ON `class_enrollment` (`school_id`,`classroom_id`,`student_id`) WHERE "class_enrollment"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `class_enrollment_school_student_year_active_unique` ON `class_enrollment` (`school_id`,`student_id`,`academic_year_id`) WHERE "class_enrollment"."status" = 'ACTIVE' AND "class_enrollment"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `class_enrollment_school_id_id_unique` ON `class_enrollment` (`school_id`,`id`);--> statement-breakpoint
CREATE INDEX `class_subject_school_id_idx` ON `class_subject` (`school_id`);--> statement-breakpoint
CREATE INDEX `class_subject_classroom_id_idx` ON `class_subject` (`classroom_id`);--> statement-breakpoint
CREATE INDEX `class_subject_subject_id_idx` ON `class_subject` (`subject_id`);--> statement-breakpoint
CREATE INDEX `class_subject_teacher_id_idx` ON `class_subject` (`teacher_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `class_subject_school_classroom_subject_unique` ON `class_subject` (`school_id`,`classroom_id`,`subject_id`) WHERE "class_subject"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `class_subject_school_id_id_unique` ON `class_subject` (`school_id`,`id`);--> statement-breakpoint
CREATE INDEX `classroom_school_id_idx` ON `classroom` (`school_id`);--> statement-breakpoint
CREATE INDEX `classroom_academic_year_id_idx` ON `classroom` (`academic_year_id`);--> statement-breakpoint
CREATE INDEX `classroom_class_level_id_idx` ON `classroom` (`class_level_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `classroom_school_year_code_unique` ON `classroom` (`school_id`,`academic_year_id`,`code`) WHERE "classroom"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `classroom_school_id_id_unique` ON `classroom` (`school_id`,`id`);--> statement-breakpoint
CREATE INDEX `student_subject_enrollment_school_id_idx` ON `student_subject_enrollment` (`school_id`);--> statement-breakpoint
CREATE INDEX `student_subject_enrollment_class_enrollment_id_idx` ON `student_subject_enrollment` (`class_enrollment_id`);--> statement-breakpoint
CREATE INDEX `student_subject_enrollment_class_subject_id_idx` ON `student_subject_enrollment` (`class_subject_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `student_subject_enrollment_school_enrollment_subject_unique` ON `student_subject_enrollment` (`school_id`,`class_enrollment_id`,`class_subject_id`) WHERE "student_subject_enrollment"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `student_subject_enrollment_school_id_id_unique` ON `student_subject_enrollment` (`school_id`,`id`);--> statement-breakpoint
CREATE INDEX `subject_school_id_idx` ON `subject` (`school_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subject_school_code_unique` ON `subject` (`school_id`,`code`) WHERE "subject"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `subject_school_id_id_unique` ON `subject` (`school_id`,`id`);