/// <reference types="vitest/config" />
import { lingui } from '@lingui/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { caldavProxy } from './server/vite-plugin-caldav-proxy.ts'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), lingui({ macroTransform: true }), tailwindcss(), caldavProxy()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: {
      '/radicale': {
        target: 'http://localhost:5232',
        headers: { 'X-Script-Name': '/radicale' },
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
