import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
export default defineConfig({
  plugins: [vue()],
  base: '/js/',
  server: { host: '0.0.0.0', port: 5173, strictPort: true, fs: { strict: true, allow: [import.meta.dirname] } },
  preview: { host: '0.0.0.0', port: 5173, strictPort: true },
});
