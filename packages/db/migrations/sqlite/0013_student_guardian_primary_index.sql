-- Re-issued as 0013 (was 0008_noisy_mephisto): the original entry's journal
-- `when` timestamp was lower than already-applied migrations, so drizzle's
-- migrator permanently skipped it on databases that had already migrated past
-- 0007 (a fresh database applied everything in order and was unaffected). This
-- renumbering with a later `when` lets existing databases pick up the DDL.
--
-- Fix: the per-student primary-link unique index must ignore soft-deleted
-- links, otherwise unlinking a primary guardian blocks assigning a new one.
DROP INDEX IF EXISTS `student_guardian_student_primary_unique`;--> statement-breakpoint
CREATE UNIQUE INDEX `student_guardian_student_primary_unique` ON `student_guardian` (`school_id`,`student_id`) WHERE "student_guardian"."is_primary" = true AND "student_guardian"."deleted_at" is null;