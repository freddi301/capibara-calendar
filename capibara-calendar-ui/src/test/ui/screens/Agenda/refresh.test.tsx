import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getApi, resetApi } from '@/api'
import { contractOf, keyOf, serveEvents } from '@/test/server'
import { event, events, renderScreen, setUpAgenda } from '@/test/support/agenda'
import { seedStored } from '@/test/support/stored'

vi.mock('@/api', async (original) => ({
  ...(await original<typeof import('@/api')>()),
  resetApi: vi.fn(),
}))

let removeSizes: () => void

beforeEach(() => {
  seedStored({ settings: { weekStart: 'monday' } })
  removeSizes = setUpAgenda()
})

afterEach(() => {
  removeSizes()
  vi.useRealTimers()
})

const asked = () => vi.mocked(getApi().listEvents).mock.calls.length

it('has the refresh button next to the settings, which asks the server for everything again', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  const bar = screen.getByRole('button', { name: 'Settings' }).parentElement as HTMLElement
  expect(
    within(bar)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label'))
      .filter((label) => label !== 'Previous day'), // the arrow of the date line is in the same bar
  ).toEqual(['Settings', 'Refresh'])
  await vi.waitFor(
    () => {
      expect(asked()).toBeGreaterThan(0)
    },
    { timeout: 4000 },
  )
  await vi.waitFor(
    () => {
      expect(screen.getByRole('button', { name: 'Refresh' })).toHaveAttribute('aria-busy', 'false')
    },
    { timeout: 4000 },
  )
  const before = asked()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))

  // then
  expect(resetApi).toHaveBeenCalledOnce() // the calendars and colors are read again too
  await vi.waitFor(
    () => {
      expect(asked()).toBeGreaterThan(before)
    },
    { timeout: 4000 },
  )
})

it('shows that it is refreshing, and stops when it is done', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  const refresh = screen.getByRole('button', { name: 'Refresh' })
  await vi.waitFor(
    () => {
      expect(refresh).toHaveAttribute('aria-busy', 'false')
    },
    { timeout: 4000 },
  )
  expect(refresh.querySelector('svg')).not.toHaveClass('animate-spin')
  let finish = () => {}
  vi.mocked(getApi().listEvents).mockReturnValue(
    new Promise<Awaited<ReturnType<ReturnType<typeof getApi>['listEvents']>>>((resolve) => {
      finish = () => {
        resolve(events.map(contractOf))
      }
    }),
  )

  // when
  await userEvent.click(refresh)

  // then
  await vi.waitFor(
    () => {
      expect(refresh).toHaveAttribute('aria-busy', 'true')
    },
    { timeout: 4000 },
  )
  expect(refresh.querySelector('svg')).toHaveClass('animate-spin')

  // when
  finish()

  // then
  await vi.waitFor(
    () => {
      expect(refresh).toHaveAttribute('aria-busy', 'false')
    },
    { timeout: 4000 },
  )
})

it('does not show or count the events of the calendars that are hidden', async () => {
  // given
  serveEvents([
    event('Standup', { startTime: '09:00', endTime: '09:30' }),
    event('Secret', { calendarUrl: '/hidden/' }),
    event('Planning', { startDate: '2026-11-13', calendarUrl: '/hidden/' }),
  ])
  seedStored({ hiddenCalendars: [keyOf('/hidden/')] })

  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(screen.queryByRole('button', { name: /Secret/ })).not.toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: /^Thursday, November 12, 2026: 1 event$/ }),
  ).toBeInTheDocument() // the count too
  expect(screen.getByRole('button', { name: /^Friday, November 13, 2026$/ })).toBeInTheDocument()
})
