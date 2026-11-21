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
  publicDir: mode === 'webxdc' ? 'public-webxdc' : 'public',
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
        target: process.env.RADICALE_URL ?? 'http://localhost:5232',
        headers: { 'X-Script-Name': '/radicale' },
        rewrite: (path) => path.replace(/^\/radicale/, ''),
      },
    },
  },
  test: {
    pool: 'vmThreads',
    css: false,
    server: { deps: { inline: ['y-webxdc'] } },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          setupFiles: ['./src/test/setup.ts'],
          include: ['src/test/unit/**/*.test.{ts,tsx}'],
        },
      },
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          setupFiles: ['./src/test/setup.ts', './src/test/setup-dom.ts'],
          include: ['src/**/*.test.{ts,tsx}'],
          exclude: ['src/test/unit/**'],
        },
      },
    ],
  },
}))

function appVersion() {
  const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string }
  const buildDate = new Date().toISOString().slice(0, 10)
  try {
    const [commit, date] = execFileSync('git', ['log', '-1', '--format=%h %cs'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    })
      .trim()
      .split(' ')
    return `v${version} ${commit} ${date}`
  } catch {
    const commit = (process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GITHUB_SHA ?? 'unknown').slice(
      0,
      7,
    )
    return `v${version} ${commit} ${buildDate}`
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
        html:
          mode === 'webxdc'
            ? html.replace(/^\s*<link rel="(?:icon|apple-touch-icon|manifest)".*\n/gm, '')
            : html,
        tags:
          server || mode === 'webxdc'
            ? [{ tag: 'script', attrs: { src: 'webxdc.js' }, injectTo: 'head-prepend' }]
            : [],
      }),
    },
  }
}
