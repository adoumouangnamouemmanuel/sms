/// <reference types="node" />
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema.sqlite.ts',
  out: './migrations/sqlite',
  driver: 'better-sqlite',
  dbCredentials: {
    url: process.env.EDUTRACK_SQLITE_PATH ?? './.data/edutrack.sqlite',
  },
} satisfies Config;
