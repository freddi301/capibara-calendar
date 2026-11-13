/// <reference types="vitest/config" />
import { lingui } from '@lingui/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { caldavProxy } from './server/vite-plugin-caldav-proxy.ts'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === 'webxdc' ? './' : '/',
  plugins: [react(), lingui({ macroTransform: true }), tailwindcss(), caldavProxy(), webxdc(mode)],
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
    projects: [
      { extends: true, test: { name: 'memory', env: { TEST_SOURCE: 'memory' } } },
      { extends: true, test: { name: 'local', env: { TEST_SOURCE: 'local' } } },
    ],
  },
}))

function webxdc(mode: string): Plugin {
  return {
    name: 'webxdc',
    configureServer(server) {
      server.middlewares.use('/webxdc.js', (_request, response) => {
        response.setHeader('Content-Type', 'text/javascript')
        response.end('')
      })
    },
    transformIndexHtml: {
      order: 'pre',
      handler: (html, { server }) => ({
        html,
        tags:
          server || mode === 'webxdc'
            ? [{ tag: 'script', attrs: { src: 'webxdc.js' }, injectTo: 'head-prepend' }]
            : [],
      }),
    },
  }
}
