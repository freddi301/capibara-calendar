import { defineConfig, devices } from '@playwright/test'
import { servers, type ServerId } from './e2e/servers.ts'

// Its own dev server, on another port than the one of the developer (5173), which is never reused.
const origin = 'http://localhost:5174'

const connected = (id: ServerId) => ({
  cookies: [],
  origins: [
    {
      origin,
      localStorage: [
        {
          name: 'capibara-calendar',
          value: JSON.stringify({
            connections: { caldav: { url: servers[id].root, username: 'dev', password: 'dev' } },
          }),
        },
      ],
    },
  ],
})

const protocolSpecs =
  /(form-patch|attendees|offline|connection|time-zone|drag-move|import-export)\.spec\.ts/

export default defineConfig<object, { server: ServerId }>({
  testDir: './e2e',
  testIgnore: '**/e2e/layout/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: 2,
  retries: process.env.CI ? 2 : 1,
  globalSetup: './e2e/global-setup.ts',
  reporter: 'html',
  expect: { timeout: 10_000 },
  use: {
    baseURL: origin,
    storageState: connected('radicale'),
    reducedMotion: 'reduce',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
    {
      name: 'baikal-desktop',
      testMatch: protocolSpecs,
      use: { ...devices['Desktop Chrome'], server: 'baikal', storageState: connected('baikal') },
    },
    {
      name: 'baikal-mobile',
      testMatch: protocolSpecs,
      use: { ...devices['Pixel 7'], server: 'baikal', storageState: connected('baikal') },
    },
  ],
  // The servers of the tests, not the ones of the hand tests (see compose.yaml). A container that
  // is already up is used again: global-setup empties it.
  webServer: [
    {
      command: 'npm run dev -- --port 5174 --strictPort',
      url: origin,
      env: { RADICALE_URL: servers.radicale.direct.origin },
      reuseExistingServer: false,
    },
    {
      command: 'docker compose -f compose.yaml up radicale-e2e',
      url: servers.radicale.direct.origin,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'docker compose -f compose.yaml up baikal-e2e',
      url: servers.baikal.direct.origin,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
