import js from '@eslint/js'
import pluginQuery from '@tanstack/eslint-plugin-query'
import { defineConfig, globalIgnores } from 'eslint/config'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import lingui from 'eslint-plugin-lingui'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'playwright-report', 'test-results', 'public/sw.js']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.strictTypeChecked,
      jsxA11y.flatConfigs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      lingui.configs['flat/recommended'],
      pluginQuery.configs['flat/recommended'],
    ],
    languageOptions: {
      ecmaVersion: 2023,
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-misused-promises': [
        'error',
        { checksVoidReturn: { attributes: false } },
      ],
      '@typescript-eslint/no-confusing-void-expression': ['error', { ignoreArrowShorthand: true }],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },
  {
    // User-visible text lives in components. Flags text not wrapped in <Trans> or t``.
    files: ['src/**/*.tsx'],
    rules: {
      'lingui/no-unlocalized-strings': [
        'error',
        {
          useTsTypes: true,
          // Technical strings that users never read.
          ignoreNames: [
            'className',
            'id',
            'type',
            'htmlFor',
            'key',
            'name',
            'role',
            'queryKey',
            'variant',
            'size',
            'align',
            'value',
            'mode',
            'form',
            'aria-hidden',
            'aria-current',
            'weekday',
            'day',
            'month',
            'year',
            'hour',
            'minute',
          ],
          ignoreFunctions: [
            'register',
            'getValues',
            'setValue',
            'resetField',
            'toLocaleString',
            'format',
            'cn',
          ],
          // The product name is not translated.
          ignore: ['^Capibara Calendar$', '^[0-9]+[+]?$'],
        },
      ],
    },
  },
  {
    // Tooling and end-to-end tests run in Node, not in the browser.
    files: ['*.config.{ts,js}', 'e2e/**'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['src/main.tsx', 'src/test/**', 'src/components/ui/**'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  {
    files: ['src/main.tsx', 'src/test/**', 'src/components/ui/**'],
    rules: { 'lingui/no-unlocalized-strings': 'off' },
  },
  {
    files: ['src/test/**'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/unbound-method': 'off',
    },
  },
  {
    files: ['src/components/ui/**'],
    rules: {
      '@typescript-eslint/no-unnecessary-condition': 'off',
      'jsx-a11y/label-has-associated-control': 'off',
    },
  },
])
