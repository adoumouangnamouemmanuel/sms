-- Phase 4.1: add the (school_id, id) unique index on class_level so the
-- composite tenant foreign keys from classroom resolve (SQLite requires a
-- unique index on the referenced columns). Additive; safe on non-empty data.
CREATE UNIQUE INDEX `class_level_school_id_id_unique` ON `class_level` (`school_id`,`id`);