import { test as base } from '@playwright/test'
import { useServer, type ServerId } from './servers.ts'

export { expect } from '@playwright/test'

export const test = base.extend<object, { server: ServerId; setServer: boolean }>({
  server: ['radicale', { option: true, scope: 'worker' }],
  setServer: [
    async ({ server }, use) => {
      useServer(server)
      await use(true)
    },
    { auto: true, scope: 'worker' },
  ],
})
