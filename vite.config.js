import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  plugins: [react()], base: './',
  build: { outDir: 'dist-renderer', emptyOutDir: true, rollupOptions: { input: path.resolve(root, 'index.html') } },
  resolve: { alias: { '@': path.resolve(root, 'src/renderer') } },
  server: { host: '0.0.0.0', port: 5173, strictPort: true, allowedHosts: true }
});
