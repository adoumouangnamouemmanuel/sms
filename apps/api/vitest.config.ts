import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '@edutrack/db': fileURLToPath(new URL('../../packages/db/src/index.ts', import.meta.url)),
      '@edutrack/shared': fileURLToPath(
        new URL('../../packages/shared/src/index.ts', import.meta.url)
      ),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Integration tests hash bcrypt (cost 12, ~300 ms per hash) and replay
    // multi-step flows; under parallel workers on a loaded Windows machine
    // the default 5 s budget is exceeded. The default timeout was observed
    // flaking locally while the same suite stays green on CI.
    testTimeout: 20_000,
  },
});
