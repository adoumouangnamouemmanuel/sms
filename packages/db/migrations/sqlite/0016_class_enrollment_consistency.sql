-- 0016: class_enrollment consistency (CodeRabbit, PR 19)
--
-- Two data-integrity gaps from the Phase 4 review:
--
-- 1. A class_enrollment row could reference a classroom from academic year A
--    while carrying an academic_year_id from year B, because the two foreign
--    keys were validated independently. SQLite cannot add a FOREIGN KEY
--    constraint to an existing table (ALTER TABLE ... ADD CONSTRAINT is not
--    supported) and a full table rebuild is unsafe here: the migrator runs
--    inside a single transaction where PRAGMA foreign_keys = OFF is a no-op,
--    so DROP TABLE would fail on databases that already hold
--    student_subject_enrollment rows. The invariant is therefore enforced
--    with BEFORE INSERT/BEFORE UPDATE triggers that abort on mismatch, the
--    same guarantee a composite FK would provide.
-- 2. class_enrollment_school_classroom_student_unique was partial only on
--    deleted_at, so a transfer back to a previous classroom collided with the
--    retained TRANSFERRED history row. The index now covers ACTIVE rows only,
--    matching the one-live-enrollment-per-student/year rule.

DROP INDEX `class_enrollment_school_classroom_student_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `class_enrollment_school_classroom_student_unique` ON `class_enrollment` (`school_id`,`classroom_id`,`student_id`) WHERE "class_enrollment"."status" = 'ACTIVE' AND "class_enrollment"."deleted_at" is null;--> statement-breakpoint
CREATE TRIGGER `class_enrollment_classroom_year_insert_check`
BEFORE INSERT ON `class_enrollment`
FOR EACH ROW
WHEN (
  SELECT `classroom`.`academic_year_id`
  FROM `classroom`
  WHERE `classroom`.`school_id` = NEW.`school_id`
    AND `classroom`.`id` = NEW.`classroom_id`
    AND `classroom`.`deleted_at` IS NULL
) IS NOT NEW.`academic_year_id`
BEGIN
  SELECT RAISE(ABORT, 'class_enrollment academic_year_id must match the classroom academic year');
END;--> statement-breakpoint
CREATE TRIGGER `class_enrollment_classroom_year_update_check`
BEFORE UPDATE OF `classroom_id`, `academic_year_id` ON `class_enrollment`
FOR EACH ROW
WHEN (
  SELECT `classroom`.`academic_year_id`
  FROM `classroom`
  WHERE `classroom`.`school_id` = NEW.`school_id`
    AND `classroom`.`id` = NEW.`classroom_id`
    AND `classroom`.`deleted_at` IS NULL
) IS NOT NEW.`academic_year_id`
BEGIN
  SELECT RAISE(ABORT, 'class_enrollment academic_year_id must match the classroom academic year');
END;
