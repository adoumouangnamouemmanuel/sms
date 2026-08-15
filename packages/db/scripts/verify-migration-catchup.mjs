import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const Database = require('better-sqlite3');
const here = dirname(fileURLToPath(import.meta.url));
const pkgRoot = join(here, '..');
const migrateScript = join(here, 'migrate-sqlite.ts');

const CLASS_TABLES = [
  'subject',
  'classroom',
  'class_subject',
  'class_enrollment',
  'student_subject_enrollment',
];

function runMigrate(dbPath) {
  execFileSync(
    process.execPath,
    ['--import', 'tsx', migrateScript],
    {
      cwd: pkgRoot,
      env: { ...process.env, EDUTRACK_SQLITE_PATH: dbPath },
      stdio: 'pipe',
    }
  );
}

function appliedCount(db) {
  return db.prepare('SELECT COUNT(*) AS n FROM __drizzle_migrations').get().n;
}

function hasTables(db) {
  const rows = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name IN ('subject','classroom','class_subject','class_enrollment','student_subject_enrollment')"
    )
    .all();
  return rows.map((r) => r.name);
}

// ---- Test 1: fresh database applies every migration in order ----
const freshPath = join(process.env.TEMP ?? '/tmp', 'edutrack-fresh-check.sqlite');
rmSync(freshPath, { force: true });
runMigrate(freshPath);
{
  const db = new Database(freshPath, { readonly: true });
  const tables = hasTables(db);
  console.log(
    `[fresh] applied=${appliedCount(db)} classesTables=[${tables.join(',')}] ${
      tables.length === CLASS_TABLES.length ? 'PASS' : 'FAIL'
    }`
  );
  db.close();
}
rmSync(freshPath, { force: true });

// ---- Test 2: an already-migrated database (0000-0007 + 0011/0012) catches up ----
const apdata = process.env.APPDATA + '/EduTrack/edutrack.sqlite';
if (!existsSync(apdata)) {
  console.log('[existing] APPDATA DB not found, skipping');
  process.exit(0);
}

// Take a consistent snapshot via VACUUM INTO (works while the app holds WAL).
const snapshotPath = join(process.env.TEMP ?? '/tmp', 'edutrack-catchup-source.sqlite');
rmSync(snapshotPath, { force: true });
{
  const src = new Database(apdata, { readonly: true });
  src.prepare(`VACUUM INTO '${snapshotPath.replaceAll("'", "''")}'`).run();
  src.close();
}

let schoolsBefore = 0;
let studentsBefore = 0;
{
  const before = new Database(snapshotPath, { readonly: true });
  schoolsBefore = before.prepare('SELECT COUNT(*) AS n FROM school').get().n;
  studentsBefore = before.prepare('SELECT COUNT(*) AS n FROM student').get().n;
  console.log(
    `[existing] before: applied=${appliedCount(before)} schools=${schoolsBefore} students=${studentsBefore} classesTables=[${hasTables(before).join(',')}]`
  );
  before.close();
}

runMigrate(snapshotPath);

{
  const after = new Database(snapshotPath, { readonly: true });
  const schoolsAfter = after.prepare('SELECT COUNT(*) AS n FROM school').get().n;
  const studentsAfter = after.prepare('SELECT COUNT(*) AS n FROM student').get().n;
  const tables = hasTables(after);
  const primaryIdx = after
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='student_guardian_student_primary_unique' AND sql LIKE '%deleted_at%'")
    .all();
  const classLevelIdx = after
    .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='class_level_school_id_id_unique'")
    .all();
  const ok =
    tables.length === CLASS_TABLES.length &&
    schoolsAfter === schoolsBefore &&
    studentsAfter === studentsBefore &&
    primaryIdx.length === 1 &&
    classLevelIdx.length === 1;
  console.log(
    `[existing] after: applied=${appliedCount(after)} schools=${schoolsAfter} students=${studentsAfter} classesTables=[${tables.join(',')}] primaryIdxFix=${primaryIdx.length === 1} classLevelIdx=${classLevelIdx.length === 1} => ${ok ? 'PASS' : 'FAIL'}`
  );
  after.close();
}

rmSync(snapshotPath, { force: true });
