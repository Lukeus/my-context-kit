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
      '*.log',
      // Files not in tsconfig but required for build tooling
      'forge.env.d.ts',
      'vite.shared.alias.ts'
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
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Warn on 'any' to allow gradual migration while preventing new violations
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/strict-boolean-expressions': ['warn', {
        allowString: true,  // Allow string checks - common pattern
        allowNumber: true,  // Allow number checks - common pattern
        allowNullableObject: true,
        allowNullableBoolean: true,
        allowNullableString: true,
        allowNullableNumber: true,  // Allow nullable number checks
        allowAny: true  // Allow any for gradual migration
      }],
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/await-thenable': 'error',
      '@typescript-eslint/no-misused-promises': 'error'
    }
  },
  {
    // Relaxed rules for test files
    files: ['**/*.spec.ts', '**/*.test.ts', 'e2e/**/*.ts', 'tests/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn', // Allow any in tests with warning
      '@typescript-eslint/strict-boolean-expressions': 'off' // Disable in tests for flexibility
    }
  }
);
