import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = new URL('./', import.meta.url);

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/renderer', rootDir)),
      '~main': fileURLToPath(new URL('./src/main', rootDir)),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
    },
  },
});
