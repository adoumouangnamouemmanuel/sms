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

const targetTriple = commandOutput('rustc', ['--print', 'host-tuple']);

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
    throw new Error(result.stderr || `Command failed: ${command} ${args.join(' ')}`);
  }

  return result.stdout.trim();
}

function run(command, args) {
  const result = spawnSync(command, args, {
    cwd: packageRoot,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(' ')}`);
  }
}
