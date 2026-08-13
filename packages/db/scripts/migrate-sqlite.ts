import 'dotenv/config';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openEduTrackDatabase } from '../src/index';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const workspaceRoot = resolve(packageRoot, '..', '..');
const sqlitePath = process.env.EDUTRACK_SQLITE_PATH
  ? resolve(process.env.EDUTRACK_SQLITE_PATH)
  : resolve(workspaceRoot, '.data', 'edutrack.sqlite');
const migrationsFolder = resolve(packageRoot, 'migrations/sqlite');
const connection = openEduTrackDatabase(sqlitePath);

try {
  migrate(connection.db, { migrationsFolder });
  process.stdout.write(`Applied SQLite migrations in ${sqlitePath}\n`);
} finally {
  connection.close();
}
