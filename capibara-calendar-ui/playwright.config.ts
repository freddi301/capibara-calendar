import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  globalSetup: './e2e/global-setup.ts',
  reporter: 'html',
  expect: { timeout: 10_000 },
  use: {
    baseURL: 'http://localhost:5173',
    storageState: {
      cookies: [],
      origins: [
        {
          origin: 'http://localhost:5173',
          localStorage: [
            {
              name: 'capibara-calendar-hidden-calendars',
              value: JSON.stringify([
                'http://localhost:5173/radicale/dev/scenarios/',
                'http://localhost:5173/radicale/dev/scenarios-b/',
              ]),
            },
            {
              // As an older version kept it: the password goes to the session when the page loads.
              name: 'capibara-calendar-connection',
              value: JSON.stringify({ url: '/radicale/', username: 'dev', password: 'dev' }),
            },
          ],
        },
      ],
    },
    reducedMotion: 'reduce',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    { command: 'npm run dev', url: 'http://localhost:5173', reuseExistingServer: !process.env.CI },
    {
      command: 'docker compose -f ../compose.yaml up radicale',
      url: 'http://localhost:5232',
      reuseExistingServer: !process.env.CI,
    },
  ],
})
