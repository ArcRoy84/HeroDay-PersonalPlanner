// Lint config focused on the errors that actually bite this codebase:
// undefined identifiers (which a bundler will happily ship) and unused ones
// (which is how a refactor leaves dead imports behind). Style is left alone.
import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  { ignores: ['dist/**', 'node_modules/**'] },

  {
    files: ['src/**/*.{js,jsx}'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...js.configs.recommended.rules,

      // Only the two classic hook rules. The plugin's v7 preset also enables
      // the React Compiler rules (preserve-manual-memoization,
      // set-state-in-effect), which flag long-standing patterns throughout
      // this codebase — worth a deliberate pass of its own, not a blocker on
      // every lint run.
      'react-hooks/rules-of-hooks': 'error',

      // JSX compiles to _jsx() calls, so React and component identifiers look
      // unused to the base rule. Vars are still checked; args are not.
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^(React|_)',
        argsIgnorePattern: '^_',
        args: 'none',
      }],

      // The codebase intentionally uses a few effects with trimmed dependency
      // arrays, each with an inline eslint-disable explaining why.
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  {
    // TypeScript is checked by tsc; ESLint's base rules misread its syntax.
    files: ['src/**/*.ts'],
    rules: {},
    languageOptions: { globals: { ...globals.browser } },
  },
];
