import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';
import { CAPABILITY_HEADER } from '../dist/sidecar-contract.js';

const require = createRequire(import.meta.url);
const scriptDir = fileURLToPath(new URL('.', import.meta.url));
const packageRoot = resolve(scriptDir, '..');
const workspaceRoot = resolve(packageRoot, '..', '..');
const binariesDir = join(workspaceRoot, 'apps', 'desktop', 'src-tauri', 'binaries');
const sidecarPath = process.env.EDUTRACK_SIDECAR_PATH ?? resolveSidecarPath();
const verificationToken = 'phase-1-sidecar-verification-token';
const tempDir = mkdtempSync(join(tmpdir(), 'edutrack-sidecar-'));
const sqlitePath = join(tempDir, 'edutrack.sqlite');

let sidecar;
let verificationError;
let cleanupFailure;

try {
  sidecar = spawn(sidecarPath, [], {
    cwd: packageRoot,
    env: {
      ...process.env,
      EDUTRACK_API_HOST: '127.0.0.1',
      EDUTRACK_API_PORT: '0',
      EDUTRACK_ALLOWED_ORIGIN: 'tauri://localhost;http://127.0.0.1:5173',
      EDUTRACK_SIDECAR_TOKEN: verificationToken,
      EDUTRACK_SQLITE_PATH: sqlitePath,
      LOG_LEVEL: 'error',
      NODE_ENV: 'production',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const readyPayload = await waitForReadyPayload(sidecar);
  const healthUrl = `http://${readyPayload.host}:${readyPayload.port}${readyPayload.healthPath}`;
  const response = await fetch(healthUrl, {
    headers: {
      Origin: 'tauri://localhost',
      [CAPABILITY_HEADER]: verificationToken,
    },
  });

  if (!response.ok) {
    throw new Error(`Health check failed with HTTP ${response.status}.`);
  }

  const body = await response.json();
  const database = body?.data?.database;

  if (!body?.success || database?.migrated !== true) {
    throw new Error(`Health check returned an unhealthy payload: ${JSON.stringify(body)}`);
  }

  if (!existsSync(sqlitePath)) {
    throw new Error(`Expected SQLite database was not created at ${sqlitePath}.`);
  }

  verifyApplicationTables(sqlitePath);

  console.log(`Sidecar verified at ${healthUrl}`);
  console.log(`SQLite probe database created at ${sqlitePath}`);
} catch (error) {
  verificationError = error;
} finally {
  const cleanupErrors = [];

  if (sidecar) {
    try {
      await stopSidecar(sidecar);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  if (process.env.EDUTRACK_KEEP_VERIFY_DB !== '1') {
    try {
      await removeTempDir(tempDir);
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  if (cleanupErrors.length > 0) {
    const cleanupError = new AggregateError(cleanupErrors, 'Sidecar verification cleanup failed.');

    if (verificationError) {
      console.warn(cleanupError.message);
      for (const error of cleanupErrors) {
        console.warn(error);
      }
    } else {
      cleanupFailure = cleanupError;
    }
  }
}

if (verificationError) {
  throw verificationError;
}

if (cleanupFailure) {
  throw cleanupFailure;
}

function resolveSidecarPath() {
  if (!existsSync(binariesDir)) {
    throw new Error('Sidecar binary directory is missing. Run build:sidecar first.');
  }

  const sidecar = readdirSync(binariesDir).find((file) =>
    /^edutrack-api-sidecar-.+\.exe$/.test(file)
  );

  if (!sidecar) {
    throw new Error('Sidecar executable is missing. Run build:sidecar first.');
  }

  return join(binariesDir, sidecar);
}

function waitForReadyPayload(child) {
  return new Promise((resolveReady, rejectReady) => {
    let settled = false;
    let stdout = '';
    let stderr = '';
    let lineBuffer = '';

    const timer = setTimeout(() => {
      rejectOnce(
        new Error(
          `Timed out waiting for the sidecar ready payload.\nstdout:\n${stdout}\nstderr:\n${stderr}`
        )
      );
    }, 15_000);

    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');

    child.stdout.on('data', (chunk) => {
      stdout += chunk;
      lineBuffer += chunk;

      const lines = lineBuffer.split(/\r?\n/);
      lineBuffer = lines.pop() ?? '';

      for (const line of lines) {
        const payload = parseReadyLine(line);

        if (payload) {
          resolveOnce(payload);
          return;
        }
      }
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk;
    });

    child.on('error', rejectOnce);
    child.on('exit', (code, signal) => {
      rejectOnce(
        new Error(
          `Sidecar exited before it became ready. code=${code} signal=${signal}\nstdout:\n${stdout}\nstderr:\n${stderr}`
        )
      );
    });

    function resolveOnce(payload) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      resolveReady(payload);
    }

    function rejectOnce(error) {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timer);
      rejectReady(error);
    }
  });
}

function parseReadyLine(line) {
  try {
    const payload = JSON.parse(line);

    if (payload?.type === 'edutrack-sidecar-ready') {
      return payload;
    }
  } catch {
    return null;
  }

  return null;
}

async function stopSidecar(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  const exited = waitForExit(child);

  if (!child.killed) {
    child.kill();
  }

  await exited;
}

function waitForExit(child) {
  return new Promise((resolveExit) => {
    const timeout = setTimeout(resolveExit, 5_000);

    child.once('exit', () => {
      clearTimeout(timeout);
      resolveExit();
    });
  });
}

async function removeTempDir(path) {
  const attempts = 3;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      rmSync(path, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === attempts) {
        throw error;
      }

      await sleep(100 * attempt);
    }
  }
}

function verifyApplicationTables(databasePath) {
  const Database = require('better-sqlite3');
  const sqlite = new Database(databasePath, { readonly: true });

  try {
    const expectedTables = ['school', 'user', 'audit_log', 'schema_metadata'];
    const rows = sqlite
      .prepare(
        `
          SELECT name
          FROM sqlite_master
          WHERE type = 'table'
            AND name IN (${expectedTables.map(() => '?').join(', ')})
        `
      )
      .all(...expectedTables);
    const tableNames = new Set(rows.map((row) => row.name));
    const missingTables = expectedTables.filter((tableName) => !tableNames.has(tableName));

    if (missingTables.length > 0) {
      throw new Error(
        `Packaged sidecar did not apply application migrations. Missing tables: ${missingTables.join(', ')}`
      );
    }
  } finally {
    sqlite.close();
  }
}
