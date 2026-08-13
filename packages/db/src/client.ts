import Database from 'better-sqlite3';
import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import * as schema from './schema.sqlite';

export type EduTrackDatabase = BetterSQLite3Database<typeof schema>;
export type EduTrackTransaction = Parameters<Parameters<EduTrackDatabase['transaction']>[0]>[0];

export interface EduTrackDatabaseConnection {
  db: EduTrackDatabase;
  sqlite: Database.Database;
  close: () => void;
}

export function openEduTrackDatabase(sqlitePath: string): EduTrackDatabaseConnection {
  mkdirSync(dirname(sqlitePath), { recursive: true });

  const sqlite = new Database(sqlitePath);
  sqlite.pragma('foreign_keys = ON');
  sqlite.pragma('journal_mode = WAL');

  return {
    db: drizzle(sqlite, { schema }),
    sqlite,
    close: () => sqlite.close(),
  };
}

export function withTransaction<T>(
  db: EduTrackDatabase,
  operation: (transaction: EduTrackTransaction) => T
) {
  return db.transaction(operation);
}
