import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { visualizer } from 'rollup-plugin-visualizer';
import { alias } from './vite.shared.alias';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [
    vue(),
    visualizer({
      filename: './dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    })
  ],
  resolve: {
    alias
  }
});
