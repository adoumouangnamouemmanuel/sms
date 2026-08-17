-- Phase 3.7/3.8/3.9: versioned grading-policy model and appreciation scales.
--   grading_policy              versioned policy header (DRAFT/PUBLISHED/SUPERSEDED)
--   assessment_type_definition  SINGLE | REPEATABLE with min/max occurrences
--   derived_result_definition   V1 operation MEAN over assessment types
--   subject_result_definition   exactly one official subject result per policy
--   subject_result_input        weighted source (assessment type or derived)
--   policy_scope                school default -> level -> level + subject
--   appreciation_scale          versioned scale with bands
--   appreciation_band           inclusive bounds in hundredths + fr/ar/en labels
-- Calculation-graph validity (acyclic, weights total 100%) is enforced by the
-- pure domain at publish time; the schema enforces structural invariants and
-- scope uniqueness.
--
-- Rollback rationale: Irreversible. Dropping the tables would remove
-- configuration that later phases (grade entry, bulletin) depend on.
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `grading_policy` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`logical_policy_id` text NOT NULL,
	`version` integer NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`scale_max` integer NOT NULL,
	`pass_threshold` integer NOT NULL,
	`decimal_precision` integer DEFAULT 2 NOT NULL,
	`rounding_mode` text DEFAULT 'HALF_UP' NOT NULL,
	`effective_academic_year_id` text,
	`created_by` text,
	`published_by` text,
	`published_at` text,
	`supersedes_policy_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `grading_policy_scale_max_check` CHECK(`scale_max` >= 1 AND `scale_max` <= 100),
	CONSTRAINT `grading_policy_pass_threshold_check` CHECK(`pass_threshold` >= 0),
	CONSTRAINT `grading_policy_status_check` CHECK(`status` in ('DRAFT', 'PUBLISHED', 'SUPERSEDED')),
	CONSTRAINT `grading_policy_rounding_check` CHECK(`rounding_mode` in ('HALF_UP', 'TRUNCATE')),
	FOREIGN KEY (`school_id`,`effective_academic_year_id`) REFERENCES `academic_year`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);--> statement-breakpoint
CREATE INDEX `grading_policy_school_id_idx` ON `grading_policy` (`school_id`);--> statement-breakpoint
CREATE INDEX `grading_policy_logical_policy_id_idx` ON `grading_policy` (`logical_policy_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `grading_policy_school_id_id_unique` ON `grading_policy` (`school_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `grading_policy_school_logical_version_unique` ON `grading_policy` (`school_id`,`logical_policy_id`,`version`);--> statement-breakpoint
CREATE TABLE `assessment_type_definition` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`grading_policy_id` text NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`scale_max` integer NOT NULL,
	`occurrence_mode` text NOT NULL,
	`min_occurrences` integer NOT NULL,
	`max_occurrences` integer NOT NULL,
	`required` integer DEFAULT true NOT NULL,
	`teacher_can_create_instances` integer DEFAULT true NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `assessment_type_definition_occurrence_mode_check` CHECK(`occurrence_mode` in ('SINGLE', 'REPEATABLE')),
	CONSTRAINT `assessment_type_definition_scale_max_check` CHECK(`scale_max` >= 1),
	CONSTRAINT `assessment_type_definition_min_occurrences_check` CHECK(`min_occurrences` >= 0),
	CONSTRAINT `assessment_type_definition_max_occurrences_check` CHECK(`max_occurrences` >= `min_occurrences`),
	FOREIGN KEY (`school_id`,`grading_policy_id`) REFERENCES `grading_policy`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);--> statement-breakpoint
CREATE INDEX `assessment_type_definition_school_id_idx` ON `assessment_type_definition` (`school_id`);--> statement-breakpoint
CREATE INDEX `assessment_type_definition_grading_policy_id_idx` ON `assessment_type_definition` (`grading_policy_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `assessment_type_definition_school_id_id_unique` ON `assessment_type_definition` (`school_id`,`id`);--> statement-breakpoint
CREATE TABLE `derived_result_definition` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`grading_policy_id` text NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`operation` text NOT NULL,
	`source_definition_ids` text NOT NULL,
	`precision` integer DEFAULT 2 NOT NULL,
	`rounding_mode` text DEFAULT 'HALF_UP' NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `derived_result_definition_operation_check` CHECK(`operation` in ('MEAN')),
	CONSTRAINT `derived_result_definition_rounding_check` CHECK(`rounding_mode` in ('HALF_UP', 'TRUNCATE')),
	FOREIGN KEY (`school_id`,`grading_policy_id`) REFERENCES `grading_policy`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);--> statement-breakpoint
CREATE INDEX `derived_result_definition_school_id_idx` ON `derived_result_definition` (`school_id`);--> statement-breakpoint
CREATE INDEX `derived_result_definition_grading_policy_id_idx` ON `derived_result_definition` (`grading_policy_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `derived_result_definition_school_id_id_unique` ON `derived_result_definition` (`school_id`,`id`);--> statement-breakpoint
CREATE TABLE `subject_result_definition` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`grading_policy_id` text NOT NULL,
	`name` text NOT NULL,
	`short_name` text NOT NULL,
	`precision` integer DEFAULT 2 NOT NULL,
	`rounding_mode` text DEFAULT 'HALF_UP' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `subject_result_definition_rounding_check` CHECK(`rounding_mode` in ('HALF_UP', 'TRUNCATE')),
	FOREIGN KEY (`school_id`,`grading_policy_id`) REFERENCES `grading_policy`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);--> statement-breakpoint
CREATE INDEX `subject_result_definition_school_id_idx` ON `subject_result_definition` (`school_id`);--> statement-breakpoint
CREATE INDEX `subject_result_definition_grading_policy_id_idx` ON `subject_result_definition` (`grading_policy_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subject_result_definition_school_id_id_unique` ON `subject_result_definition` (`school_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subject_result_definition_school_policy_unique` ON `subject_result_definition` (`school_id`,`grading_policy_id`) WHERE `deleted_at` is null;--> statement-breakpoint
CREATE TABLE `subject_result_input` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`subject_result_definition_id` text NOT NULL,
	`source_definition_id` text NOT NULL,
	`weight` integer NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `subject_result_input_weight_check` CHECK(`weight` > 0),
	FOREIGN KEY (`school_id`,`subject_result_definition_id`) REFERENCES `subject_result_definition`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);--> statement-breakpoint
CREATE INDEX `subject_result_input_school_id_idx` ON `subject_result_input` (`school_id`);--> statement-breakpoint
CREATE INDEX `subject_result_input_subject_result_definition_id_idx` ON `subject_result_input` (`subject_result_definition_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `subject_result_input_school_id_id_unique` ON `subject_result_input` (`school_id`,`id`);--> statement-breakpoint
CREATE TABLE `policy_scope` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`grading_policy_id` text NOT NULL,
	`scope_type` text NOT NULL,
	`class_level_id` text,
	`subject_id` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `policy_scope_type_check` CHECK(`scope_type` in ('SCHOOL_DEFAULT', 'LEVEL', 'LEVEL_SUBJECT')),
	CONSTRAINT `policy_scope_shape_check` CHECK((`scope_type` = 'SCHOOL_DEFAULT' AND `class_level_id` IS NULL AND `subject_id` IS NULL) OR (`scope_type` = 'LEVEL' AND `class_level_id` IS NOT NULL AND `subject_id` IS NULL) OR (`scope_type` = 'LEVEL_SUBJECT' AND `class_level_id` IS NOT NULL AND `subject_id` IS NOT NULL)),
	FOREIGN KEY (`school_id`,`grading_policy_id`) REFERENCES `grading_policy`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`class_level_id`) REFERENCES `class_level`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`,`subject_id`) REFERENCES `subject`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);--> statement-breakpoint
CREATE INDEX `policy_scope_school_id_idx` ON `policy_scope` (`school_id`);--> statement-breakpoint
CREATE INDEX `policy_scope_grading_policy_id_idx` ON `policy_scope` (`grading_policy_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `policy_scope_school_id_id_unique` ON `policy_scope` (`school_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `policy_scope_school_default_unique` ON `policy_scope` (`school_id`) WHERE `scope_type` = 'SCHOOL_DEFAULT' AND `deleted_at` is null;--> statement-breakpoint
CREATE UNIQUE INDEX `policy_scope_level_unique` ON `policy_scope` (`school_id`,`class_level_id`) WHERE `scope_type` = 'LEVEL' AND `deleted_at` is null;--> statement-breakpoint
CREATE UNIQUE INDEX `policy_scope_level_subject_unique` ON `policy_scope` (`school_id`,`class_level_id`,`subject_id`) WHERE `scope_type` = 'LEVEL_SUBJECT' AND `deleted_at` is null;--> statement-breakpoint
CREATE TABLE `appreciation_scale` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`logical_scale_id` text NOT NULL,
	`version` integer NOT NULL,
	`name` text NOT NULL,
	`status` text DEFAULT 'DRAFT' NOT NULL,
	`scale_max` integer NOT NULL,
	`published_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `appreciation_scale_status_check` CHECK(`status` in ('DRAFT', 'PUBLISHED', 'SUPERSEDED')),
	CONSTRAINT `appreciation_scale_scale_max_check` CHECK(`scale_max` >= 1),
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);--> statement-breakpoint
CREATE INDEX `appreciation_scale_school_id_idx` ON `appreciation_scale` (`school_id`);--> statement-breakpoint
CREATE INDEX `appreciation_scale_logical_scale_id_idx` ON `appreciation_scale` (`logical_scale_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `appreciation_scale_school_id_id_unique` ON `appreciation_scale` (`school_id`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `appreciation_scale_school_logical_version_unique` ON `appreciation_scale` (`school_id`,`logical_scale_id`,`version`);--> statement-breakpoint
CREATE TABLE `appreciation_band` (
	`id` text PRIMARY KEY NOT NULL,
	`school_id` text NOT NULL,
	`appreciation_scale_id` text NOT NULL,
	`lower_bound` integer NOT NULL,
	`upper_bound` integer NOT NULL,
	`label_fr` text NOT NULL,
	`label_ar` text NOT NULL,
	`label_en` text NOT NULL,
	`short_label` text NOT NULL,
	`display_order` integer DEFAULT 0 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`record_version` integer DEFAULT 1 NOT NULL,
	`deleted_at` text,
	CONSTRAINT `appreciation_band_lower_bound_check` CHECK(`lower_bound` >= 0),
	CONSTRAINT `appreciation_band_upper_bound_check` CHECK(`upper_bound` >= `lower_bound`),
	FOREIGN KEY (`school_id`,`appreciation_scale_id`) REFERENCES `appreciation_scale`(`school_id`,`id`) ON UPDATE cascade ON DELETE restrict,
	FOREIGN KEY (`school_id`) REFERENCES `school`(`id`) ON UPDATE cascade ON DELETE restrict
);--> statement-breakpoint
CREATE INDEX `appreciation_band_school_id_idx` ON `appreciation_band` (`school_id`);--> statement-breakpoint
CREATE INDEX `appreciation_band_appreciation_scale_id_idx` ON `appreciation_band` (`appreciation_scale_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `appreciation_band_school_id_id_unique` ON `appreciation_band` (`school_id`,`id`);--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
PRAGMA foreign_key_check;
