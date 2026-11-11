import { focusManager, type QueryClient } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  calendarStamp,
  listCalendars,
  listEvents,
  saveEvent,
  type CalendarEvent,
} from '../lib/caldav'
import { calendarsStaleTime, createQueryClient, eventsStaleTime } from '../lib/query-client'
import CreateEditEventScreen from '../screens/CreateEditEventScreen'
import FilterScreen from '../screens/FilterScreen'
import DaysScreen from '../screens/DaysScreen'
import { pagerOf, scrollToPage } from './pager'
import { renderApp } from './render'
import { serveEvents } from './server'

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
  serveEvents([standup], [{ url: '/c/', name: 'Personal', color: '#2563eb' }])
  vi.mocked(calendarStamp).mockResolvedValue('v1')
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

const starts = () =>
  vi
    .mocked(listEvents)
    .mock.calls.map(([, range]) => range.start)
    .sort()

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
  expect(eventsStaleTime).toBe(10 * 60 * 1000)
})

it('asks for the events of the month of the week, and for the month before and the one after', async () => {
  week(appClient())
  await screen.findByRole('button', { name: /Standup/ })

  await waitFor(() => {
    expect(starts()).toEqual(['2026-10-01', '2026-11-01', '2026-12-01'])
  })
  expect(calendarStamp).toHaveBeenCalledTimes(1) // once for all the months of the calendar
})

it('does not ask for the events again when the weeks are shown again, soon after', async () => {
  const client = appClient()
  const first = week(client)
  await screen.findByRole('button', { name: /Standup/ })
  await waitFor(() => {
    expect(listEvents).toHaveBeenCalledTimes(3)
  })
  first.unmount()

  week(client)

  expect(await screen.findByRole('button', { name: /Standup/ })).toBeInTheDocument()
  expect(listEvents).toHaveBeenCalledTimes(3) // the months were kept
})

it('does not ask for the events when the window gets the focus back, and the calendar did not change', async () => {
  const client = appClient()
  week(client)
  await screen.findByRole('button', { name: /Standup/ })
  vi.setSystemTime(new Date('2026-11-12T10:00:30')) // what it knows of the calendar is not new

  act(() => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
  })

  await waitFor(() => {
    expect(calendarStamp).toHaveBeenCalledTimes(2) // it asked if the calendar changed
  })
  expect(listEvents).toHaveBeenCalledTimes(3) // and it did not: the months were kept
})

it('asks for the events when the window gets the focus back, and the calendar changed', async () => {
  const client = appClient()
  week(client)
  await screen.findByRole('button', { name: /Standup/ })
  vi.setSystemTime(new Date('2026-11-12T10:00:30'))
  vi.mocked(calendarStamp).mockResolvedValue('changed')

  act(() => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
  })

  await waitFor(() => {
    expect(listEvents).toHaveBeenCalledTimes(4) // the month on the screen
  })
})

it('asks if the calendar changed when what it has is old, and keeps it when it did not', async () => {
  const client = appClient()
  const first = week(client)
  await screen.findByRole('button', { name: /Standup/ })
  first.unmount()

  vi.setSystemTime(new Date('2026-11-12T10:11:00')) // eleven minutes later
  week(client)

  await waitFor(() => {
    expect(calendarStamp).toHaveBeenCalledTimes(2)
  })
  expect(await screen.findByRole('button', { name: /Standup/ })).toBeInTheDocument()
  expect(listEvents).toHaveBeenCalledTimes(3)
})

it('asks for the events again when what it has is old, and the calendar changed', async () => {
  const client = appClient()
  const first = week(client)
  await screen.findByRole('button', { name: /Standup/ })
  first.unmount()

  vi.setSystemTime(new Date('2026-11-12T10:11:00'))
  vi.mocked(calendarStamp).mockResolvedValue('changed')
  week(client)

  await waitFor(() => {
    expect(listEvents).toHaveBeenCalledTimes(6) // the three months, again
  })
})

it('does not trust what it has, when the server tells nothing of the calendar', async () => {
  vi.mocked(calendarStamp).mockResolvedValue(undefined)
  const client = appClient()
  const first = week(client)
  await screen.findByRole('button', { name: /Standup/ })
  first.unmount()

  vi.setSystemTime(new Date('2026-11-12T10:11:00'))
  week(client)

  await waitFor(() => {
    expect(listEvents).toHaveBeenCalledTimes(6)
  })
})

it('does not ask for the events of a month again when it moves to another week of it', async () => {
  const client = appClient()
  week(client)
  await screen.findByRole('button', { name: /Standup/ })
  await waitFor(() => {
    expect(listEvents).toHaveBeenCalledTimes(3)
  })
  const pager = pagerOf(screen.getByRole('group', { name: 'Week' }))

  await scrollToPage(pager, 'x', 2) // the next week
  await scrollToPage(pager, 'x', 0) // and back
  await screen.findByRole('button', { name: /Standup/ })

  expect(listEvents).toHaveBeenCalledTimes(3)
  expect(within(screen.getByRole('group', { name: 'Week' })).getAllByRole('button')).toHaveLength(7)
})

it('does not ask for the events of the calendars that are hidden', async () => {
  serveEvents([standup, { ...standup, uid: '2', url: '/h/2.ics', calendarUrl: '/h/' }])
  localStorage.setItem('capibara-calendar-hidden-calendars', JSON.stringify(['/h/']))

  week(appClient())
  await screen.findByRole('button', { name: /Standup/ })

  await waitFor(() => {
    expect(listEvents).toHaveBeenCalledTimes(3)
  })
  expect(vi.mocked(listEvents).mock.calls.every(([url]) => url === '/c/')).toBe(true)
})

it('asks again only for the events of the calendar that is saved to', async () => {
  const client = appClient()
  const chunk = { stamp: 'v1', events: [standup] }
  client.setQueryData(['events', '/c/', '2026-11'], chunk)
  client.setQueryData(['events', '/other/', '2026-11'], chunk)
  renderApp(<CreateEditEventScreen event={standup} onClose={vi.fn()} />, client)

  await userEvent.click(await screen.findByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(client.getQueryState(['events', '/c/', '2026-11'])?.isInvalidated).toBe(true)
  })
  expect(client.getQueryState(['events', '/other/', '2026-11'])?.isInvalidated).toBe(false)
  expect(client.getQueryData<typeof chunk>(['events', '/c/', '2026-11'])?.stamp).toBe('') // not taken as good
})

it('asks again for both calendars when an event is moved from one to the other', async () => {
  const client = appClient()
  const chunk = { stamp: 'v1', events: [standup] }
  client.setQueryData(['events', '/c/', '2026-11'], chunk)
  client.setQueryData(['events', '/other/', '2026-11'], chunk)
  vi.mocked(listCalendars).mockResolvedValue([
    { url: '/c/', name: 'Personal', color: '#2563eb' },
    { url: '/other/', name: 'Other', color: '#dc2626' },
  ])
  renderApp(<CreateEditEventScreen event={standup} onClose={vi.fn()} />, client)
  await userEvent.click(await screen.findByRole('combobox', { name: 'Calendar' }))
  await userEvent.click(await screen.findByRole('option', { name: 'Other' }))

  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(client.getQueryState(['events', '/c/', '2026-11'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['events', '/other/', '2026-11'])?.isInvalidated).toBe(true)
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
  expect(listEvents).toHaveBeenCalledTimes(2) // the month on the screen: the first time, and one more; the others wait for it
})
