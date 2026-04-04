import js from '@eslint/js'
import tseslint from 'typescript-eslint'
import prettierConfig from 'eslint-config-prettier'

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettierConfig,
  {
    rules: {
      // Start lenient — tighten over time
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'prefer-const': 'warn',
      'no-console': 'off',
    },
  },
  {
    ignores: [
      'node_modules/',
      '.next/',
      'dist/',
      'dist-electron/',
      'renders/',
      'render-server/',
      'public/',
      'website/',
      'website2/',
      'lego-sandbox/',
      'reference/',
      'drizzle/',
      'electron/',
      'scripts/',
    ],
  },
)
