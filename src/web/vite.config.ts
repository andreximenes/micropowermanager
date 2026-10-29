/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The new app, the legacy Vue app and the API share one origin so they share the
// session in localStorage. In development this dev server is that origin: it
// proxies /api to the Laravel backend and /legacy to the legacy dev server.
const apiTarget = process.env.MPM_DEV_API_URL ?? 'http://localhost:8000';
const legacyTarget = process.env.MPM_DEV_LEGACY_URL ?? 'http://localhost:8001';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': new URL('./src', import.meta.url).pathname },
  },
  server: {
    port: 8003,
    proxy: {
      // The API authenticates with a bearer token, never cookies. Every cookie other local
      // apps left on `localhost` would otherwise ride along and overflow Apache's header
      // limit (400 Bad Request).
      '/api': {
        target: apiTarget,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (request) => request.removeHeader('cookie'));
        },
      },
      '/legacy': { target: legacyTarget, changeOrigin: true, ws: true },
      // The legacy dev server's live-reload socket connects to the page origin.
      '/ws': { target: legacyTarget, changeOrigin: true, ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Under coverage every core runs a file; a file's first render (router, Leaflet, forms) can
    // then take several seconds, which is contention, not a hang.
    testTimeout: 15000,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/test/**',
        'src/**/*.test.{ts,tsx}',
      ],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 85 },
    },
  },
});
