import { configure, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { date, event, events, renderScreen, setUpAgenda } from '@/test/support/agenda'
import { seedStored } from '@/test/support/stored'

// A table of 42 days with a hundred events in one: slow when many files run at once.
vi.setConfig({ testTimeout: 15_000 })
configure({ asyncUtilTimeout: 10_000 })

let removeSizes: () => void

// The week runs from Monday, so the table of November 2026 is from Monday 26 October to Sunday 6 December.
beforeEach(() => {
  seedStored({ pickerMode: 'month', settings: { weekStart: 'monday' } })
  removeSizes = setUpAgenda([
    ...events,
    event('Cleanup', { startDate: '2026-10-28' }), // in the table, but in October
    ...Array.from({ length: 100 }, (_, index) =>
      event(`Busy ${index}`, { startDate: '2026-11-21' }),
    ),
  ])
})

afterEach(() => {
  removeSizes()
  vi.useRealTimers()
})

const month = () => within(screen.getByRole('group', { name: 'Month' })).getAllByRole('button')
const day = (label: RegExp) => screen.getByRole('button', { name: label })

it('shows the weeks of the month, with the days of the months around it', async () => {
  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  const days = month()
  expect(days).toHaveLength(42)
  expect(days[0]).toHaveAccessibleName(/^Monday, October 26, 2026/)
  expect(days[41]).toHaveAccessibleName(/^Sunday, December 6, 2026/)
  expect(day(/^Thursday, November 12/)).toHaveAttribute('aria-pressed', 'true')
  expect(day(/^Thursday, November 12/)).toHaveAttribute('aria-current', 'date')
  expect(date()).toHaveValue('2026-11-12')
})

it('always has six weeks, so that the table has the same height', async () => {
  // given: November 2026 needs five weeks, from Sunday 1 to Monday 30
  seedStored({ settings: { weekStart: 'sunday' } })

  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(month()).toHaveLength(42)
  expect(month()[0]).toHaveAccessibleName(/^Sunday, November 1, 2026/)
  expect(month()[41]).toHaveAccessibleName(/^Saturday, December 12, 2026/)
})

it('names the weekdays once, above the table', async () => {
  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  expect((screen.getByText('Mon').parentElement as HTMLElement).textContent).toBe(
    'MonTueWedThuFriSatSun',
  )
  expect(screen.getAllByText('Mon')).toHaveLength(1)
})

it('counts the events of each day, also in the days of the months around it', async () => {
  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(day(/^Thursday, November 12, 2026: 2 events/)).toBeInTheDocument()
  expect(day(/^Tuesday, November 10, 2026$/)).toBeInTheDocument() // nothing planned: no count
  expect(within(day(/^Saturday, November 21, 2026/)).getByText('99+')).toBeInTheDocument()
  expect(day(/^Wednesday, October 28, 2026: 1 event/)).toBeInTheDocument() // the month before
})

it('follows the day that is tapped in the month before, and shows its month', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // when
  await userEvent.click(day(/^Wednesday, October 28/))

  // then
  expect(date()).toHaveValue('2026-10-28')
  expect(screen.getByRole('combobox', { name: 'Month: October' })).toBeInTheDocument()
  expect(month()[0]).toHaveAccessibleName(/^Monday, September 28, 2026/) // the table moved
})
