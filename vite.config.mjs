// Vite builds the React renderer from src/ into build/, which Electron loads from disk
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Strict policy for the packaged app. Left out in dev, where React Refresh needs inline scripts.
const CSP = "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self' data:";

export default defineConfig({
  root: 'src',
  base: './',   // relative asset paths, so build/index.html works over file://
  plugins: [
    react(),
    {
      name: 'content-security-policy',
      apply: 'build',
      transformIndexHtml: html => html.replace('<head>', `<head>\n  <meta http-equiv="Content-Security-Policy" content="${CSP}">`)
    }
  ],
  build: {
    outDir: '../build',
    emptyOutDir: true,
    target: 'chrome140'   // the Chromium inside Electron 45
  },
  server: { port: 5173, strictPort: true }
});
