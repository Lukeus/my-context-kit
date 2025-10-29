import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      '.vite/**',
      'out/**',
      'build/**',
      'node_modules/**',
      'coverage/**',
      '.playwright-report/**',
      'context-repo/**',
      'eslint.config.js',
      '*.cjs',
      '*.config.*',
      '*.log'
    ]
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-expressions': 'off'
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn'
    }
  }
);
