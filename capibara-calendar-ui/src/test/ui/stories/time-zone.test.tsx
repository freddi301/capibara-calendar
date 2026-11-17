import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getApi } from '@/api'
import App from '@/App'
import { renderApp } from '@/test/render'
import { choose, openSettings, setUpApp } from '@/test/support/app'

vi.mock('@/api/sources', async (original) => ({
  ...(await original<typeof import('@/api/sources')>()),
  checkCaldav: vi.fn(),
}))
vi.mock('@/api', async (original) => ({
  ...(await original<typeof import('@/api')>()),
  resetApi: vi.fn(),
}))

beforeEach(setUpApp)

afterEach(() => {
  vi.useRealTimers()
})

it('shows the week on the chosen first day, and today in the chosen time zone', async () => {
  // given
  vi.setSystemTime(new Date('2026-11-12T12:00:00Z')) // already the 13th on Kiritimati
  renderApp(<App />)
  await openSettings()

  // when
  await choose('Time zone', 'Kiritimati')
  await choose('First day of the week', 'Saturday')
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  // then
  const week = await screen.findByRole('group', { name: 'Week' })
  expect(within(week).getAllByRole('button')[0]).toHaveAccessibleName(/^Saturday, November 7/)
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-13')
}, 15_000)

it('reads the events again after the time zone was changed', async () => {
  // given
  renderApp(<App />)
  await screen.findByRole('button', { name: /Dentist/ })
  await waitFor(() => {
    expect(getApi().listEvents).toHaveBeenCalledTimes(12) // the months of the agenda and the ones beside them, of the two calendars
  })

  // when
  await openSettings()
  await choose('Time zone', 'Tokyo')
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  // then
  await screen.findByRole('button', { name: /Dentist/ })
  await waitFor(() => {
    expect(getApi().listEvents).toHaveBeenCalledTimes(24) // the times are worked out in the zone, when read
  })
})
