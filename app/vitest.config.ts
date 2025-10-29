import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';

const rootDir = new URL('./', import.meta.url);

export default defineConfig({
  // Note: Plugin type casting required due to Vite/Vitest plugin interface differences in current versions.
  // This is a known limitation and does not affect runtime behavior or test execution.
  plugins: [vue() as unknown as any],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/renderer', rootDir)),
      '~main': fileURLToPath(new URL('./src/main', rootDir)),
      '@shared': fileURLToPath(new URL('./src/shared', rootDir)),
      electron: fileURLToPath(new URL('./tests/mocks/electron.ts', rootDir)),
    },
  },
  define: {
    'import.meta.vitest': 'undefined',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'forks',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.spec.ts', 'src/**/*.test.ts', '!e2e/**/*.spec.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    server: {
      deps: {
        inline: ['electron'],
      },
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'e2e/**'],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
  },
});
