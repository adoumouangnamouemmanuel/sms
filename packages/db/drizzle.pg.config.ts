/// <reference types="node" />
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/schema.pg.ts',
  out: './migrations/pg',
  driver: 'pg', // Can be dynamically switched based on env
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgres://postgres:password@localhost:5234/edutrack',
  },
} satisfies Config;
