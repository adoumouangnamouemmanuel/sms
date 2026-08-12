/// <reference types="node" />
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema.sqlite.ts',
  out: './migrations/sqlite',
  driver: 'better-sqlite',
  dbCredentials: {
    url: process.env.DATABASE_URL_SQLITE || './edutrack.db',
  },
} satisfies Config;
