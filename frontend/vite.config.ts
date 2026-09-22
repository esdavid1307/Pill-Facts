/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // The app calls /api on its own origin, so there is no CORS configuration anywhere
    // and no API URL to configure. nginx and the Pages Function do the same job in the
    // built image and in production. See ADR-0011.
    proxy: {
      '/api': {
        target: process.env.PILLFACTS_BACKEND_URL ?? 'http://localhost:8080',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: true,
  },
})
