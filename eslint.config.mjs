import js from '@eslint/js';
import { defineConfig } from 'eslint/config';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {
    ignores: [
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/.next/**',
      '**/.expo/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/.corepack/**',
      'docs/archive/**',
      'packages/db/migrations/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.eslint.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    files: ['apps/web/src/**/*.{ts,tsx}'],
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@edutrack/api*', '@edutrack/db*', '../../api/*', '../../desktop/*'],
              message:
                'The web UI may depend only on UI/shared/domain packages, never API, desktop, or database adapters.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/domain/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@edutrack/db*',
                '@edutrack/ui*',
                '@edutrack/api*',
                '@edutrack/web*',
                '@edutrack/desktop*',
              ],
              message:
                'Domain code must stay pure and cannot import adapters, applications, or UI packages.',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['packages/db/src/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@edutrack/api*', '@edutrack/web*', '@edutrack/desktop*'],
              message: 'Database code cannot depend on application packages.',
            },
          ],
        },
      ],
    },
  },
]);
