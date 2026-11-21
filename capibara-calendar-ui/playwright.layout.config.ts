import { defineConfig } from '@playwright/test'

const origin = 'http://localhost:5175'

export default defineConfig({
  testDir: './e2e/layout',
  fullyParallel: true,
  workers: 6,
  reporter: 'html',
  use: { baseURL: origin, reducedMotion: 'reduce', browserName: 'chromium' },
  webServer: {
    command: 'npm run dev -- --port 5175 --strictPort',
    url: origin,
    reuseExistingServer: false,
  },
})
