import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import type DatabaseConstructor from 'better-sqlite3';

const APP_DATA_FOLDER = 'EduTrack';
const DEFAULT_SQLITE_FILENAME = 'edutrack.sqlite';
const DEPLOYMENT_MIGRATION_ID = 'deployment-probe-0001';
const Database = loadDatabaseConstructor();

type BetterSqlite3Constructor = typeof DatabaseConstructor;

export interface DeploymentDatabaseStatus {
  sqlitePath: string;
  migrated: boolean;
  migrationId: string;
}

export function resolveDefaultSqlitePath(env: NodeJS.ProcessEnv = process.env) {
  const appDataRoot = env.APPDATA ?? env.LOCALAPPDATA;

  if (appDataRoot) {
    return join(appDataRoot, APP_DATA_FOLDER, DEFAULT_SQLITE_FILENAME);
  }

  return join(process.cwd(), '.data', DEFAULT_SQLITE_FILENAME);
}

export function resolveConfiguredSqlitePath(env: NodeJS.ProcessEnv = process.env) {
  return env.EDUTRACK_SQLITE_PATH ?? resolveDefaultSqlitePath(env);
}

export function ensureDeploymentDatabase(sqlitePath = resolveConfiguredSqlitePath()) {
  mkdirSync(dirname(sqlitePath), { recursive: true });

  const database = new Database(sqlitePath);

  try {
    database.pragma('journal_mode = WAL');
    database.exec(`
      CREATE TABLE IF NOT EXISTS __edutrack_deployment_migrations (
        id TEXT PRIMARY KEY NOT NULL,
        applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS __edutrack_deployment_probe (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        last_verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);

    const migration = database
      .prepare('SELECT id FROM __edutrack_deployment_migrations WHERE id = ?')
      .get(DEPLOYMENT_MIGRATION_ID);

    const transaction = database.transaction(() => {
      if (!migration) {
        database
          .prepare('INSERT INTO __edutrack_deployment_migrations (id) VALUES (?)')
          .run(DEPLOYMENT_MIGRATION_ID);
      }

      database
        .prepare(
          `
            INSERT INTO __edutrack_deployment_probe (id)
            VALUES (1)
            ON CONFLICT(id) DO UPDATE SET last_verified_at = CURRENT_TIMESTAMP
          `
        )
        .run();
    });

    transaction();

    return {
      sqlitePath,
      migrated: true,
      migrationId: DEPLOYMENT_MIGRATION_ID,
    } satisfies DeploymentDatabaseStatus;
  } finally {
    database.close();
  }
}

function loadDatabaseConstructor(): BetterSqlite3Constructor {
  if (typeof require === 'function') {
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- pkg needs this literal require to include better-sqlite3's native binding.
    return require('better-sqlite3') as BetterSqlite3Constructor;
  }

  return createRequire(import.meta.url)('better-sqlite3') as BetterSqlite3Constructor;
}
