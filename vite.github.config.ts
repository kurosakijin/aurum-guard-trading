import tailwindcss from '@tailwindcss/postcss';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const projectRoot = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  root: fileURLToPath(new URL('./github-pages', import.meta.url)),
  base: '/aurum-guard-trading/',
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  css: { postcss: { plugins: [tailwindcss()] } },
  resolve: { alias: { '@': projectRoot } },
  plugins: [react()],
  build: {
    outDir: fileURLToPath(new URL('./github-dist', import.meta.url)),
    emptyOutDir: true,
  },
});
