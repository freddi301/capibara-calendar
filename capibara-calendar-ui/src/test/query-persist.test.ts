import type { Query } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'

const removed = vi.fn<(key: string) => Promise<void>>()
vi.mock('idb-keyval', () => ({
  get: vi.fn(() => Promise.resolve(undefined)),
  set: vi.fn(() => Promise.resolve()),
  del: (key: string) => removed(key),
}))

const { persistOptions, forgetPersistedQueries } =
  await vi.importActual<typeof import('../lib/query-persist')>('../lib/query-persist')

const query = (key: unknown[], status: 'success' | 'pending' | 'error' = 'success') =>
  ({ queryKey: key, state: { status } }) as unknown as Query

beforeEach(() => {
  removed.mockReset()
  removed.mockResolvedValue()
})

it('keeps the events and the calendars that were asked for, and nothing else', () => {
  const keeps = persistOptions.dehydrateOptions?.shouldDehydrateQuery
  expect(keeps?.(query(['events', '/c/', '2026-11']))).toBe(true)
  expect(keeps?.(query(['calendars']))).toBe(true)
  expect(keeps?.(query(['stamp', '/c/']))).toBe(false) // it is only for a moment
  expect(keeps?.(query(['events', '/c/', '2026-11'], 'pending'))).toBe(false)
  expect(keeps?.(query(['events', '/c/', '2026-11'], 'error'))).toBe(false)
})

it('keeps them for a week, at most', () => {
  expect(persistOptions.maxAge).toBe(7 * 24 * 60 * 60 * 1000)
})

it('forgets them all when the connection ends, and does not fail when the database is blocked', async () => {
  await forgetPersistedQueries()
  expect(removed).toHaveBeenCalledWith('capibara-calendar-query-cache')

  removed.mockRejectedValue(new Error('blocked'))
  await expect(forgetPersistedQueries()).resolves.toBeUndefined()
})
