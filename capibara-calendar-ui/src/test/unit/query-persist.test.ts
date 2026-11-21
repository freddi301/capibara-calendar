import type { Query } from '@tanstack/react-query'
import { beforeEach, expect, it, vi } from 'vitest'
import { setApi } from '@/api'
import type { CalendarApi } from '@/api/calendar-api'

const removed = vi.fn<(key: string) => Promise<void>>()
vi.mock('idb-keyval', () => ({
  get: vi.fn(() => Promise.resolve(undefined)),
  set: vi.fn(() => Promise.resolve()),
  del: (key: string) => removed(key),
}))

const { persistOptions, forgetPersistedQueries } =
  await vi.importActual<typeof import('@/lib/query-persist')>('@/lib/query-persist')

const query = (key: unknown[], status: 'success' | 'pending' | 'error' = 'success') =>
  ({ queryKey: key, state: { status } }) as unknown as Query

beforeEach(() => {
  removed.mockReset()
  removed.mockResolvedValue()
})

it('keeps the events of a server and the calendars, and nothing else', () => {
  setApi({
    subscribe: () => () => undefined,
    sources: () => [
      { id: 'caldav', kind: 'caldav', name: 'Server' },
      { id: 'memory', kind: 'memory', name: 'Memory' },
    ],
  } as unknown as CalendarApi)
  const keeps = persistOptions.dehydrateOptions?.shouldDehydrateQuery
  expect(keeps?.(query(['events', 'caldav//c/', '2026-11']))).toBe(true)
  expect(keeps?.(query(['calendars']))).toBe(true)
  expect(keeps?.(query(['stamp', 'caldav//c/']))).toBe(false) // it is only for a moment
  expect(keeps?.(query(['events', 'caldav//c/', '2026-11'], 'pending'))).toBe(false)
  expect(keeps?.(query(['events', 'caldav//c/', '2026-11'], 'error'))).toBe(false)
})

it('does not keep the events of the sources that are a database of their own', () => {
  setApi({
    subscribe: () => () => undefined,
    sources: () => [
      { id: 'caldav', kind: 'caldav', name: 'Server' },
      { id: 'memory', kind: 'memory', name: 'Memory' },
      { id: 'local', kind: 'local', name: 'Local' },
      { id: 'chat', kind: 'webxdc', name: 'Chat' },
    ],
  } as unknown as CalendarApi)
  const keeps = persistOptions.dehydrateOptions?.shouldDehydrateQuery
  for (const source of ['memory', 'local', 'chat', 'removed']) {
    expect(keeps?.(query(['events', `${source}/c`, '2026-11']))).toBe(false)
  }
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
