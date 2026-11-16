import { defineConfig } from '@playwright/test'

// The layout tests (see LAYOUT-MATRIX.md): they run on the seeded memory source, so they need
// neither the CalDAV servers nor the global setup, and they are not part of `test:e2e`.
const origin = 'http://localhost:5173'

export default defineConfig({
  testDir: './e2e/layout',
  fullyParallel: true,
  workers: 2,
  reporter: 'html',
  use: { baseURL: origin, reducedMotion: 'reduce', browserName: 'chromium' },
  webServer: { command: 'npm run dev', url: origin, reuseExistingServer: !process.env.CI },
})
