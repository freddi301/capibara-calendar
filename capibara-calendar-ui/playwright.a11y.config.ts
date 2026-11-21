import { defineConfig } from '@playwright/test'

// The a11y tests: axe on the seeded memory source (`?seed=…`), with no CalDAV server. Its own dev
// server, on another port than the one of the developer (5173) and the ones of the other kinds.
const origin = 'http://localhost:5176'

export default defineConfig({
  testDir: './e2e/a11y',
  fullyParallel: true,
  workers: 6,
  reporter: 'html',
  use: { baseURL: origin, reducedMotion: 'reduce', locale: 'en-US', browserName: 'chromium' },
  webServer: {
    command: 'npm run dev -- --port 5176 --strictPort',
    url: origin,
    reuseExistingServer: false,
  },
})
