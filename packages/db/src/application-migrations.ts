import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { openEduTrackDatabase } from './client';

const SQLITE_MIGRATIONS_FOLDER_ENV = 'EDUTRACK_SQLITE_MIGRATIONS_DIR';

interface PkgProcess extends NodeJS.Process {
  pkg?: {
    entrypoint?: string;
  };
}

export interface ApplicationMigrationStatus {
  sqlitePath: string;
  migrationsFolder: string;
  migrated: true;
}

export function applyApplicationMigrations(
  sqlitePath: string,
  migrationsFolder = resolveSqliteMigrationsFolder()
): ApplicationMigrationStatus {
  const connection = openEduTrackDatabase(sqlitePath);

  try {
    migrate(connection.db, { migrationsFolder });

    return {
      sqlitePath,
      migrationsFolder,
      migrated: true,
    };
  } finally {
    connection.close();
  }
}

export function resolveSqliteMigrationsFolder(env: NodeJS.ProcessEnv = process.env) {
  const configuredFolder = env[SQLITE_MIGRATIONS_FOLDER_ENV];

  if (configuredFolder) {
    return requireMigrationsFolder(resolve(configuredFolder));
  }

  for (const candidate of sqliteMigrationsFolderCandidates()) {
    if (isMigrationsFolder(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Could not find SQLite migrations. Set ${SQLITE_MIGRATIONS_FOLDER_ENV} or include packages/db/migrations/sqlite in the sidecar package.`
  );
}

function sqliteMigrationsFolderCandidates() {
  const candidates = new Set<string>();
  const packagedEntrypoint = (process as PkgProcess).pkg?.entrypoint;

  if (packagedEntrypoint) {
    candidates.add(
      join(dirname(packagedEntrypoint), '..', '..', '..', 'packages', 'db', 'migrations', 'sqlite')
    );
  }

  candidates.add(resolve(process.cwd(), 'packages', 'db', 'migrations', 'sqlite'));
  candidates.add(resolve(process.cwd(), '..', '..', 'packages', 'db', 'migrations', 'sqlite'));
  candidates.add(resolve(process.cwd(), 'migrations', 'sqlite'));

  return [...candidates];
}

function requireMigrationsFolder(migrationsFolder: string) {
  if (!isMigrationsFolder(migrationsFolder)) {
    throw new Error(`SQLite migrations folder is missing meta/_journal.json: ${migrationsFolder}`);
  }

  return migrationsFolder;
}

function isMigrationsFolder(migrationsFolder: string) {
  return existsSync(join(migrationsFolder, 'meta', '_journal.json'));
}
