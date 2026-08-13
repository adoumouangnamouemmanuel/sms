import 'dotenv/config';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyApplicationMigrations } from '../src/index';

const packageRoot = fileURLToPath(new URL('..', import.meta.url));
const workspaceRoot = resolve(packageRoot, '..', '..');
const sqlitePath = process.env.EDUTRACK_SQLITE_PATH
  ? resolve(process.env.EDUTRACK_SQLITE_PATH)
  : resolve(workspaceRoot, '.data', 'edutrack.sqlite');
const migrationsFolder = resolve(packageRoot, 'migrations/sqlite');
const status = applyApplicationMigrations(sqlitePath, migrationsFolder);

process.stdout.write(`Applied SQLite migrations in ${status.sqlitePath}\n`);
