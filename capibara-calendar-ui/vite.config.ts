/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Same-origin access to the local Radicale server (see ../compose.yaml).
      // Radicale does not answer CORS preflights, so the browser must not call it directly.
      '/radicale': {
        target: 'http://localhost:5232',
        rewrite: (path) => path.replace(/^\/radicale/, ''),
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    css: false,
  },
})
