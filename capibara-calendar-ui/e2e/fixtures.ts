import { test as base, type BrowserContextOptions } from '@playwright/test'
import { useServer, userOf, type ServerId } from './servers.ts'

export { expect } from '@playwright/test'

type Storage = Exclude<BrowserContextOptions['storageState'], string | undefined>

// The project saves the connection of the user `dev`: here it is the one of the user of the worker.
function ofUser(storage: Storage, user: string): Storage {
  return {
    ...storage,
    origins: storage.origins.map((origin) => ({
      ...origin,
      localStorage: origin.localStorage.map(({ name, value }) => {
        const stored = JSON.parse(value) as { connections?: { caldav?: { username: string } } }
        if (stored.connections?.caldav) stored.connections.caldav.username = user
        return { name, value: JSON.stringify(stored) }
      }),
    })),
  }
}

export const test = base.extend<object, { server: ServerId; setServer: boolean }>({
  server: ['radicale', { option: true, scope: 'worker' }],
  setServer: [
    async ({ server }, run, { parallelIndex }) => {
      useServer(server, parallelIndex)
      await run(true)
    },
    { auto: true, scope: 'worker' },
  ],
  storageState: async ({ storageState, server }, run, { parallelIndex }) => {
    // The ones that start without a connection (`test.use({ storageState: … })`) have no origins.
    const connected = typeof storageState === 'object' && storageState.origins.length > 0
    await run(connected ? ofUser(storageState, userOf(server, parallelIndex)) : storageState)
  },
})
