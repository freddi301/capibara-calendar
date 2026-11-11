import { focusManager, type QueryClient } from '@tanstack/react-query'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { listCalendars, listEvents, saveEvent, type CalendarEvent } from '../lib/caldav'
import { calendarsStaleTime, createQueryClient } from '../lib/query-client'
import CreateEditEventScreen from '../screens/CreateEditEventScreen'
import FilterScreen from '../screens/FilterScreen'
import DaysScreen from '../screens/DaysScreen'
import { pagerOf, scrollToPage } from './pager'
import { renderApp } from './render'

vi.mock('../lib/caldav')

const standup: CalendarEvent = {
  calendarUrl: '/c/',
  uid: '1',
  url: '/c/1.ics',
  ics: '',
  title: 'Standup',
  description: '',
  startDate: '2026-11-12',
  startTime: '09:00',
  endDate: '',
  endTime: '',
}

beforeEach(() => {
  vi.setSystemTime(new Date('2026-11-12T10:00:00'))
  vi.mocked(listEvents).mockResolvedValue([standup])
  vi.mocked(listCalendars).mockResolvedValue([{ url: '/c/', name: 'Personal', color: '#2563eb' }])
  vi.mocked(saveEvent).mockResolvedValue()
})

afterEach(() => {
  vi.useRealTimers()
})

// The client of the app, with what it keeps, and without the waits of a second try.
function appClient() {
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } })
  return client
}

const week = (client: QueryClient) =>
  renderApp(
    <DaysScreen
      onCreate={vi.fn()}
      onEdit={vi.fn()}
      onOpenSettings={vi.fn()}
      onOpenLayouts={vi.fn()}
      onOpenFilter={vi.fn()}
    />,
    client,
  )

it('keeps what it asked for a while, and for a long time what is not on a screen any more', () => {
  const { staleTime, gcTime, retry } = createQueryClient().getDefaultOptions().queries ?? {}

  expect(staleTime).toBe(2 * 60 * 1000)
  expect(gcTime).toBe(30 * 60 * 1000)
  expect(retry).toBe(1) // a server that does not answer is asked once more
  expect(calendarsStaleTime).toBe(30 * 60 * 1000)
})

it('does not ask for the events of a week again when it is shown again, soon after', async () => {
  const client = appClient()
  const first = week(client)
  await screen.findByRole('button', { name: /Standup/ })
  first.unmount()

  week(client)

  expect(await screen.findByRole('button', { name: /Standup/ })).toBeInTheDocument()
  expect(listEvents).toHaveBeenCalledTimes(3) // as many as the first time: the weeks were kept
})

it('does not ask again when the window gets the focus back, while what it has is not old', async () => {
  const client = appClient()
  week(client)
  await screen.findByRole('button', { name: /Standup/ })

  act(() => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
  })
  fireEvent.focus(window)

  expect(listEvents).toHaveBeenCalledTimes(3) // one for each week of the pager, once
})

it('asks again when it is old', async () => {
  const client = appClient()
  const first = week(client)
  await screen.findByRole('button', { name: /Standup/ })
  first.unmount()

  vi.setSystemTime(new Date('2026-11-12T10:03:00')) // three minutes later
  week(client)

  await waitFor(() => {
    expect(listEvents).toHaveBeenCalledTimes(6) // the three weeks, again
  })
})

it('asks only for the new week when it moves to the next, and for none when it goes back', async () => {
  const client = appClient()
  week(client)
  await screen.findByRole('button', { name: /Standup/ })
  expect(listEvents).toHaveBeenCalledTimes(3)
  const pager = pagerOf(screen.getByRole('group', { name: 'Week' }))

  await scrollToPage(pager, 'x', 2) // the next week
  await waitFor(() => {
    expect(listEvents).toHaveBeenCalledTimes(4) // the week after it only
  })
  await scrollToPage(pager, 'x', 0) // and back
  await screen.findByRole('button', { name: /Standup/ })

  expect(listEvents).toHaveBeenCalledTimes(4) // the weeks were kept
  expect(within(screen.getByRole('group', { name: 'Week' })).getAllByRole('button')).toHaveLength(7)
})

it('asks again for the events, which are old for it, when one is saved', async () => {
  const client = appClient()
  client.setQueryData(['events', '2026-11-08', '2026-11-14'], [standup])
  renderApp(<CreateEditEventScreen event={standup} onClose={vi.fn()} />, client)

  await userEvent.click(await screen.findByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(client.getQueryState(['events', '2026-11-08', '2026-11-14'])?.isInvalidated).toBe(true)
  })
})

it('asks for the calendars once for the screens that need them', async () => {
  const client = appClient()
  const form = renderApp(<CreateEditEventScreen onClose={vi.fn()} />, client)
  await waitFor(() => {
    expect(listCalendars).toHaveBeenCalledTimes(1)
  })
  form.unmount()

  renderApp(<FilterScreen onClose={vi.fn()} onEditCalendar={vi.fn()} />, client)

  expect(await screen.findByRole('switch', { name: 'Personal' })).toBeInTheDocument()
  expect(listCalendars).toHaveBeenCalledTimes(1)
})

it('asks again for a server that does not answer only once, not three times', async () => {
  vi.mocked(listEvents).mockRejectedValue(new TypeError('Failed to fetch'))
  const client = createQueryClient()
  client.setDefaultOptions({
    queries: { ...client.getDefaultOptions().queries, retryDelay: 0 },
  })

  week(client)

  expect(
    await screen.findByText('Cannot reach the CalDAV server', {}, { timeout: 3000 }),
  ).toBeInTheDocument()
  expect(listEvents).toHaveBeenCalledTimes(6) // each of the three weeks: the first time, and one more
})
