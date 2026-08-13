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
  },
});
