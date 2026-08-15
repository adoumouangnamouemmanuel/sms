CREATE TABLE `guardian` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`phone` text,
	`email` text,
	`address` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `student` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`code` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`sex` text,
	`date_of_birth` text,
	`place_of_birth` text,
	`nationality` text,
	`photo_url` text,
	`phone` text,
	`email` text,
	`address` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `student_sex_check` CHECK(`sex` in ('M', 'F', 'AUTRE')),
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `student_guardian` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`student_id` text NOT NULL,
	`guardian_id` text NOT NULL,
	`relationship_type` text NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`is_emergency` integer DEFAULT false NOT NULL,
	`notes` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `student_guardian_relationship_type_check` CHECK(`relationship_type` in ('PERE', 'MERE', 'TUTEUR', 'AUTRE')),
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`student_id`) REFERENCES `student`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`guardian_id`) REFERENCES `guardian`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE TABLE `teacher` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`code` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`specialization` text,
	`hire_date` text,
	`phone` text,
	`email` text,
	`address` text,
	`user_id` text,
	`is_active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`user_id`) REFERENCES `user`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict
);
--> statement-breakpoint
CREATE INDEX `guardian_school_id_idx` ON `guardian` (`school_id`);--> statement-breakpoint
CREATE INDEX `guardian_school_last_name_idx` ON `guardian` (`school_id`,`last_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `guardian_school_id_id_unique` ON `guardian` (`school_id`,`id`);--> statement-breakpoint
CREATE INDEX `student_school_id_idx` ON `student` (`school_id`);--> statement-breakpoint
CREATE INDEX `student_school_last_name_idx` ON `student` (`school_id`,`last_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `student_school_code_unique` ON `student` (`school_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `student_school_id_id_unique` ON `student` (`school_id`,`id`);--> statement-breakpoint
CREATE INDEX `student_guardian_school_id_idx` ON `student_guardian` (`school_id`);--> statement-breakpoint
CREATE INDEX `student_guardian_student_id_idx` ON `student_guardian` (`student_id`);--> statement-breakpoint
CREATE INDEX `student_guardian_guardian_id_idx` ON `student_guardian` (`guardian_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `student_guardian_school_student_guardian_unique` ON `student_guardian` (`school_id`,`student_id`,`guardian_id`) WHERE "student_guardian"."deleted_at" is null;--> statement-breakpoint
CREATE UNIQUE INDEX `student_guardian_student_primary_unique` ON `student_guardian` (`school_id`,`student_id`) WHERE "student_guardian"."is_primary" = true;--> statement-breakpoint
CREATE INDEX `teacher_school_id_idx` ON `teacher` (`school_id`);--> statement-breakpoint
CREATE INDEX `teacher_school_last_name_idx` ON `teacher` (`school_id`,`last_name`);--> statement-breakpoint
CREATE UNIQUE INDEX `teacher_school_code_unique` ON `teacher` (`school_id`,`code`);--> statement-breakpoint
CREATE UNIQUE INDEX `teacher_school_id_id_unique` ON `teacher` (`school_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `user_school_id_id_unique` ON `user` (`school_id`,`id`);