import type { CalendarEvent } from './legacy'
import { getApi } from '../api'
import { revision } from '../api/calendar-api'
import { focusManager, type QueryClient } from '@tanstack/react-query'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { calendarsStaleTime, createQueryClient, eventsStaleTime } from '../lib/query-client'
import CreateEditEventScreen from '../screens/CreateEditEventScreen'
import CalendarsScreen from '../screens/CalendarsScreen'
import AgendaScreen from '../screens/AgendaScreen'
import { pagerOf, scrollToPage } from './pager'
import { renderApp } from './render'
import { contractOf, keyOf, serveEvents } from './server'
import { seedStored } from './support/stored'

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
  vi.mocked(getApi().revision).mockResolvedValue(revision('v1'))
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
    .mocked(getApi().listEvents)
    .mock.calls.map(([, range]) => range.start)
    .sort()

const week = (client: QueryClient) =>
  renderApp(
    <AgendaScreen
      onCreate={vi.fn()}
      onEdit={vi.fn()}
      onOpenSettings={vi.fn()}
      onOpenLayouts={vi.fn()}
      onChooseLayout={vi.fn()}
      onOpenCalendars={vi.fn()}
      onOpenFilters={vi.fn()}
      onOpenView={vi.fn()}
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

it('asks for the events of the months of the agenda, and for the month before and the one after them', async () => {
  week(appClient())
  await screen.findByRole('button', { name: /Standup/ })

  await waitFor(() => {
    expect(starts()).toEqual([
      '2026-09-01', // the month before the ones of the agenda
      '2026-10-01',
      '2026-11-01',
      '2026-12-01',
      '2027-01-01',
      '2027-02-01', // the month after them
    ])
  })
  expect(getApi().revision).toHaveBeenCalledTimes(1) // once for all the months of the calendar
})

it('does not ask for the events again when the weeks are shown again, soon after', async () => {
  const client = appClient()
  const first = week(client)
  await screen.findByRole('button', { name: /Standup/ })
  await waitFor(() => {
    expect(getApi().listEvents).toHaveBeenCalledTimes(6)
  })
  first.unmount()

  week(client)

  expect(await screen.findByRole('button', { name: /Standup/ })).toBeInTheDocument()
  expect(getApi().listEvents).toHaveBeenCalledTimes(6) // the months were kept
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
    expect(getApi().revision).toHaveBeenCalledTimes(2) // it asked if the calendar changed
  })
  expect(getApi().listEvents).toHaveBeenCalledTimes(6) // and it did not: the months were kept
})

it('asks for the events when the window gets the focus back, and the calendar changed', async () => {
  const client = appClient()
  week(client)
  await screen.findByRole('button', { name: /Standup/ })
  vi.setSystemTime(new Date('2026-11-12T10:00:30'))
  vi.mocked(getApi().revision).mockResolvedValue(revision('changed'))

  act(() => {
    focusManager.setFocused(false)
    focusManager.setFocused(true)
  })

  await waitFor(() => {
    expect(getApi().listEvents).toHaveBeenCalledTimes(10) // the four months of the agenda, again; the two beside them wait
  })
})

it('asks if the calendar changed when what it has is old, and keeps it when it did not', async () => {
  const client = appClient()
  const first = week(client)
  await screen.findByRole('button', { name: /Standup/ })
  await waitFor(() => {
    expect(client.isFetching()).toBe(0) // the six months are in, whichever source is slower
  })
  first.unmount()

  vi.setSystemTime(new Date('2026-11-12T10:11:00')) // eleven minutes later
  week(client)

  await waitFor(() => {
    expect(getApi().revision).toHaveBeenCalledTimes(2)
  })
  expect(await screen.findByRole('button', { name: /Standup/ })).toBeInTheDocument()
  expect(getApi().listEvents).toHaveBeenCalledTimes(6)
})

it('asks for the events again when what it has is old, and the calendar changed', async () => {
  const client = appClient()
  const first = week(client)
  await screen.findByRole('button', { name: /Standup/ })
  await waitFor(() => {
    expect(client.isFetching()).toBe(0) // the six months are in, whichever source is slower
  })
  first.unmount()

  vi.setSystemTime(new Date('2026-11-12T10:11:00'))
  vi.mocked(getApi().revision).mockResolvedValue(revision('changed'))
  week(client)

  await waitFor(() => {
    expect(getApi().listEvents).toHaveBeenCalledTimes(12) // the six months, again
  })
})

it('does not trust what it has, when the server tells nothing of the calendar', async () => {
  vi.mocked(getApi().revision).mockResolvedValue(undefined)
  const client = appClient()
  const first = week(client)
  await screen.findByRole('button', { name: /Standup/ })
  await waitFor(() => {
    expect(client.isFetching()).toBe(0) // the six months are in, whichever source is slower
  })
  first.unmount()

  vi.setSystemTime(new Date('2026-11-12T10:11:00'))
  week(client)

  await waitFor(() => {
    expect(getApi().listEvents).toHaveBeenCalledTimes(12)
  })
})

it('does not ask for the events of a month again when it moves to another week of it', async () => {
  const client = appClient()
  week(client)
  await screen.findByRole('button', { name: /Standup/ })
  await waitFor(() => {
    expect(getApi().listEvents).toHaveBeenCalledTimes(6)
  })
  const pager = pagerOf(screen.getByRole('group', { name: 'Week' }))

  await scrollToPage(pager, 'x', 2) // the next week
  await scrollToPage(pager, 'x', 0) // and back
  await screen.findByRole('button', { name: /Standup/ })

  expect(getApi().listEvents).toHaveBeenCalledTimes(6)
  expect(within(screen.getByRole('group', { name: 'Week' })).getAllByRole('button')).toHaveLength(7)
})

it('does not ask for the events of the calendars that are hidden', async () => {
  serveEvents([standup, { ...standup, uid: '2', url: '/h/2.ics', calendarUrl: '/h/' }])
  seedStored({ hiddenCalendars: [keyOf('/h/')] })

  week(appClient())
  await screen.findByRole('button', { name: /Standup/ })

  await waitFor(() => {
    expect(getApi().listEvents).toHaveBeenCalledTimes(6)
  })
  expect(vi.mocked(getApi().listEvents).mock.calls.every(([ref]) => ref.calendarId === '/c/')).toBe(
    true,
  )
})

it('asks again only for the events of the calendar that is saved to', async () => {
  const client = appClient()
  const chunk = { stamp: 'v1', events: [standup] }
  client.setQueryData(['events', keyOf('/c/'), '2026-11'], chunk)
  client.setQueryData(['events', keyOf('/other/'), '2026-11'], chunk)
  renderApp(<CreateEditEventScreen event={contractOf(standup)} onClose={vi.fn()} />, client)

  await userEvent.click(await screen.findByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(client.getQueryState(['events', keyOf('/c/'), '2026-11'])?.isInvalidated).toBe(true)
  })
  expect(client.getQueryState(['events', keyOf('/other/'), '2026-11'])?.isInvalidated).toBe(false)
  expect(client.getQueryData<typeof chunk>(['events', keyOf('/c/'), '2026-11'])?.stamp).toBe('') // not taken as good
})

it('asks again for both calendars when an event is moved from one to the other', async () => {
  const client = appClient()
  const chunk = { stamp: 'v1', events: [standup] }
  client.setQueryData(['events', keyOf('/c/'), '2026-11'], chunk)
  client.setQueryData(['events', keyOf('/other/'), '2026-11'], chunk)
  serveEvents(
    [standup],
    [
      { url: '/c/', name: 'Personal', color: '#2563eb' },
      { url: '/other/', name: 'Other', color: '#dc2626' },
    ],
  )
  renderApp(<CreateEditEventScreen event={contractOf(standup)} onClose={vi.fn()} />, client)
  await userEvent.click(await screen.findByRole('combobox', { name: 'Calendar' }))
  await userEvent.click(await screen.findByRole('option', { name: 'Other' }))

  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(client.getQueryState(['events', keyOf('/c/'), '2026-11'])?.isInvalidated).toBe(true)
    expect(client.getQueryState(['events', keyOf('/other/'), '2026-11'])?.isInvalidated).toBe(true)
  })
})

it('asks for the calendars once for the screens that need them', async () => {
  const client = appClient()
  const form = renderApp(<CreateEditEventScreen onClose={vi.fn()} />, client)
  await waitFor(() => {
    expect(getApi().listCalendars).toHaveBeenCalledTimes(1)
  })
  form.unmount()

  renderApp(
    <CalendarsScreen
      onClose={vi.fn()}
      onEditCalendar={vi.fn()}
      onExport={vi.fn()}
      onImport={vi.fn()}
    />,
    client,
  )

  expect(await screen.findByRole('switch', { name: 'Personal' })).toBeInTheDocument()
  expect(getApi().listCalendars).toHaveBeenCalledTimes(1)
})

it('asks again for a server that does not answer only once, not three times', async () => {
  vi.mocked(getApi().listEvents).mockRejectedValue(new TypeError('Failed to fetch'))
  const client = createQueryClient()
  client.setDefaultOptions({
    queries: { ...client.getDefaultOptions().queries, retryDelay: 0 },
  })

  week(client)

  await vi.waitFor(
    () => {
      expect(getApi().listEvents).toHaveBeenCalledTimes(8)
    },
    { timeout: 3000 },
  )
  expect(getApi().listEvents).toHaveBeenCalledTimes(8) // the four months of the agenda: the first time, and one more; the others wait for them
})
