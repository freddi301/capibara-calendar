/// <reference types="vitest/config" />
import { lingui } from '@lingui/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { caldavProxy } from './server/vite-plugin-caldav-proxy.ts'

export default defineConfig(({ mode }) => ({
  base: mode === 'webxdc' ? './' : '/',
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  plugins: [react(), lingui({ macroTransform: true }), tailwindcss(), caldavProxy(), webxdc(mode)],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  server: {
    proxy: {
      '/dav.php': { target: 'http://localhost:5233' },
      '/radicale': {
        // The e2e tests point it to their own Radicale (see playwright.config.ts).
        target: process.env.RADICALE_URL ?? 'http://localhost:5232',
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
    server: { deps: { inline: ['y-webxdc'] } },
    projects: [
      { extends: true, test: { name: 'memory', env: { TEST_SOURCE: 'memory' } } },
      { extends: true, test: { name: 'local', env: { TEST_SOURCE: 'local' } } },
    ],
  },
}))

function appVersion() {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
  try {
    const commit = execFileSync('git', ['log', '-1', '--format=%h %cs'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    return `v${version} ${commit}`
  } catch {
    return `v${version}`
  }
}

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
