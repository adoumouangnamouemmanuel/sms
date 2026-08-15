// Runs drizzle-kit with TS_NODE_PROJECT set to tsconfig.drizzle.json, whose
// empty `paths` override makes the bundled loader skip the workspace src path
// mappings and resolve `@edutrack/shared` through node_modules to the compiled
// dist (see tsconfig.drizzle.json and the exports.require condition in the
// shared package). Wrapped in Node so the env var works on Windows too.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { readFileSync, realpathSync } from 'node:fs';

const require = createRequire(import.meta.url);
const drizzleRoot = dirname(realpathSync(require.resolve('drizzle-kit')));
const drizzleManifest = JSON.parse(readFileSync(join(drizzleRoot, 'package.json'), 'utf8'));
const drizzleBin = join(drizzleRoot, drizzleManifest.bin['drizzle-kit']);

const result = spawnSync(
  process.execPath,
  [drizzleBin, 'generate:sqlite', '--config=drizzle.sqlite.config.ts'],
  {
    cwd: resolve(import.meta.dirname, '..'),
    env: { ...process.env, TS_NODE_PROJECT: 'tsconfig.drizzle.json' },
    stdio: 'inherit',
  }
);

process.exit(result.status ?? 1);
