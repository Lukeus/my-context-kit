import { defineConfig } from 'vite';
import { alias } from './vite.shared.alias';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias
  },
  build: {
    rollupOptions: {
      output: {
        format: 'cjs',
        entryFileNames: '[name].cjs'
      }
    }
  }
});
