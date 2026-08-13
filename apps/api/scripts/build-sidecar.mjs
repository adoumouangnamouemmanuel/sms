import { spawnSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const require = createRequire(import.meta.url);
const scriptDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(scriptDir, '..');
const workspaceRoot = resolve(packageRoot, '..', '..');
const binariesDir = join(workspaceRoot, 'apps', 'desktop', 'src-tauri', 'binaries');
const sidecarName = 'edutrack-api-sidecar';
const pkgCliPath = require.resolve('@yao-pkg/pkg/lib-es5/bin.js');
const bundledEntryPath = join(packageRoot, 'dist', 'sidecar.cjs');
const pkgConfigPath = join(packageRoot, 'pkg.sidecar.config.cjs');

const rustcVersion = commandOutput('rustc', ['-vV']);
const targetTriple = parseRustHostTriple(rustcVersion);

if (!targetTriple.endsWith('windows-msvc')) {
  throw new Error(
    `The Phase 1.2 sidecar spike currently targets Windows MSVC, got ${targetTriple}.`
  );
}

mkdirSync(binariesDir, { recursive: true });

const outputPath = join(binariesDir, `${sidecarName}-${targetTriple}.exe`);

await build({
  entryPoints: [join(packageRoot, 'dist', 'index.js')],
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
  external: ['better-sqlite3'],
  outfile: bundledEntryPath,
  logLevel: 'info',
  logOverride: {
    'empty-import-meta': 'silent',
  },
});

run(process.execPath, [
  pkgCliPath,
  bundledEntryPath,
  '--config',
  pkgConfigPath,
  '--targets',
  'node24-win-x64',
  '--output',
  outputPath,
]);

console.log(`Built ${outputPath}`);

function commandOutput(command, args) {
  const result = spawnSync(command, args, {
    cwd: workspaceRoot,
    encoding: 'utf8',
  });

  if (result.status !== 0) {
    throw new Error(commandFailureMessage(command, args, result));
  }

  return result.stdout.trim();
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(commandFailureMessage(command, args, result));
  }
}

function parseRustHostTriple(rustcVersion) {
  const hostLine = rustcVersion.split(/\r?\n/).find((line) => line.startsWith('host:'));

  if (!hostLine) {
    throw new Error('Could not determine the Rust host triple from rustc -vV output.');
  }

  const hostTriple = hostLine.slice('host:'.length).trim();

  if (!hostTriple) {
    throw new Error('Rust host triple was empty in rustc -vV output.');
  }

  return hostTriple;
}

function commandFailureMessage(command, args, result) {
  const invocation = `${command} ${args.join(' ')}`;

  if (result.error) {
    return `Command failed: ${invocation}\n${result.error.name}: ${result.error.message}`;
  }

  return result.stderr?.trim() || `Command failed: ${invocation}`;
}
