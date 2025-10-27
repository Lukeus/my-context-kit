import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const rootDir = new URL('./', import.meta.url);

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src/renderer', rootDir)),
      '~main': fileURLToPath(new URL('./src/main', rootDir)),
      electron: fileURLToPath(new URL('./tests/mocks/electron.ts', rootDir)),
    },
  },
  ssr: {
    noExternal: ['electron'],
  },
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.spec.ts', 'src/**/*.test.ts', '!e2e/**/*.spec.ts'],
    exclude: ['e2e/**', 'node_modules/**'],
    server: {
      deps: {
        inline: ['electron'],
      },
    },
    deps: {
      optimizer: {
        ssr: {
          enabled: true,
          include: ['electron'],
        },
      },
    },
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      reporter: ['text', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.spec.ts', 'src/**/*.test.ts', 'e2e/**'],
    },
  },
});
