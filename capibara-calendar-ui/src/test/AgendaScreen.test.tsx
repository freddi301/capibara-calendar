import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { activateLocale } from '../i18n'
import { listEvents, type CalendarEvent } from '../lib/caldav'
import AgendaScreen from '../screens/AgendaScreen'
import { renderApp } from './render'
import { serveEvents } from './server'
import { giveSizes } from './virtual'

vi.mock('../lib/caldav')

function event(title: string, fields: Partial<CalendarEvent>): CalendarEvent {
  return {
    calendarUrl: '/c/',
    uid: title,
    url: `/c/${title}.ics`,
    ics: '',
    title,
    description: '',
    startDate: '2026-11-12',
    startTime: '',
    endDate: '',
    endTime: '',
    ...fields,
  }
}

// Today is Thursday 12 November 2026.
const events = [
  event('Standup', { startTime: '09:00', endTime: '09:30' }),
  event('Conference', { endDate: '2026-11-14' }),
  event('Planning', { startDate: '2026-11-16' }),
  event('Yesterday', { startDate: '2026-11-11' }),
  event('Far away', { startDate: '2028-01-01' }),
]

let removeSizes: () => void

beforeEach(() => {
  vi.setSystemTime(new Date('2026-11-12T10:00:00'))
  serveEvents(events)
  removeSizes = giveSizes()
})

afterEach(() => {
  removeSizes()
  vi.useRealTimers()
})

function renderScreen(date?: string) {
  const handlers = {
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenLayouts: vi.fn(),
    onOpenFilter: vi.fn(),
    onOpenView: vi.fn(),
  }
  renderApp(<AgendaScreen date={date} {...handlers} />)
  return handlers
}

it('lists the days with events from today on, each with its events', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  const days = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)
  expect(days).toEqual([
    'Thursday, November 12, 2026',
    'Friday, November 13, 2026',
    'Saturday, November 14, 2026',
    'Monday, November 16, 2026',
  ])
  const thursday = screen.getByRole('heading', { name: /Thursday/ }).parentElement as HTMLElement
  expect(
    within(thursday)
      .getAllByRole('button')
      .map((button) => button.textContent),
  ).toEqual(['Conference', '9:00 AM9:30 AMStandup'])
})

it('shows a multi-day event on every day it covers, and nothing from the past or far away', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(screen.getAllByRole('button', { name: /Conference/ })).toHaveLength(3)
  expect(screen.queryByRole('button', { name: /Yesterday/ })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Far away/ })).not.toBeInTheDocument()
})

it('starts on the date it is given', async () => {
  renderScreen('2026-11-14')
  await screen.findByRole('button', { name: /Planning/ })

  expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent(
    'Saturday, November 14, 2026',
  )
  expect(screen.queryByRole('button', { name: /Standup/ })).not.toBeInTheDocument()
})

it('opens an event, and the other screens, with the date it starts on', async () => {
  const { onCreate, onEdit, onOpenSettings, onOpenLayouts } = renderScreen('2026-11-14')

  await userEvent.click(await screen.findByRole('button', { name: /Planning/ }))
  await userEvent.click(screen.getByRole('button', { name: 'New event' }))
  await userEvent.click(screen.getByRole('button', { name: 'Layouts' }))
  await userEvent.click(screen.getByRole('button', { name: 'Settings' }))

  expect(onEdit).toHaveBeenCalledWith(events[2])
  expect(onCreate).toHaveBeenCalledExactlyOnceWith('2026-11-14')
  expect(onOpenLayouts).toHaveBeenCalledExactlyOnceWith('2026-11-14')
  expect(onOpenSettings).toHaveBeenCalledOnce()
})

it('reports when the server cannot be reached', async () => {
  vi.mocked(listEvents).mockRejectedValue(new Error('offline'))
  renderScreen()

  expect(await screen.findByText('Cannot reach the CalDAV server')).toBeInTheDocument()
})

it('has no days when there is nothing planned, and does not say so', async () => {
  serveEvents([])
  renderScreen()
  await screen.findByRole('status')

  expect(screen.queryAllByRole('heading', { level: 2 })).toHaveLength(0)
  expect(screen.queryByText('Nothing planned')).not.toBeInTheDocument()
})

it('is in the language of the app', async () => {
  await activateLocale('it')
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent(
    'Giovedì 12 novembre 2026',
  )
})

// jsdom has no layout: say where the edge of the list is, and where each day is from it.
function scrollList(tops: Record<string, number>, scrollTop: number) {
  const list = screen.getAllByRole('heading', { level: 2 })[0].closest('section') as HTMLElement
  vi.spyOn(list, 'getBoundingClientRect').mockReturnValue({ top: 0 } as DOMRect)
  for (const day of list.querySelectorAll<HTMLElement>('[data-day]')) {
    const top = tops[day.dataset.day as string]
    vi.spyOn(day, 'getBoundingClientRect').mockReturnValue({ top } as DOMRect)
  }
  Object.defineProperty(list, 'scrollTop', { value: scrollTop, configurable: true })
  fireEvent.scroll(list)
}

const date = () => screen.getByLabelText('Choose a date')
const tops = { '2026-11-12': -200, '2026-11-13': -50, '2026-11-14': 120, '2026-11-16': 300 }

it('has the date line, with the date the list starts on', async () => {
  renderScreen('2026-11-14')
  await screen.findByRole('button', { name: /Planning/ })

  expect(date()).toHaveValue('2026-11-14')
  expect(screen.getByRole('combobox', { name: 'Month: November' })).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Year: 2026' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
  // The top bar has the line below it, and the space of the one of the week rows.
  expect(date().parentElement?.parentElement).toHaveClass('border-b', 'pb-2')
})

it('shows in the date line the day that is at the top of the list while it scrolls', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  expect(date()).toHaveValue('2026-11-12')

  scrollList(tops, 150) // Thursday is above the top edge, Friday has just gone past it
  expect(date()).toHaveValue('2026-11-13')

  scrollList({ ...tops, '2026-11-13': -300, '2026-11-14': -90, '2026-11-16': 5 }, 400)
  expect(date()).toHaveValue('2026-11-16') // a day that is just at the edge counts as the top

  scrollList(tops, 0) // back at the top: the day the list started on
  expect(date()).toHaveValue('2026-11-12')
})

it('creates an event and opens the layouts with the day that scrolling has reached', async () => {
  const { onCreate, onOpenLayouts } = renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  scrollList(tops, 150)

  await userEvent.click(screen.getByRole('button', { name: 'New event' }))
  await userEvent.click(screen.getByRole('button', { name: 'Layouts' }))

  expect(onCreate).toHaveBeenCalledExactlyOnceWith('2026-11-13')
  expect(onOpenLayouts).toHaveBeenCalledExactlyOnceWith('2026-11-13')
})

it('starts the list on the date that is chosen, at its top', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  const list = screen.getAllByRole('heading', { level: 2 })[0].closest('section') as HTMLElement
  let scrolled = 300
  Object.defineProperty(list, 'scrollTop', {
    get: () => scrolled,
    set: (value: number) => {
      scrolled = value
    },
    configurable: true,
  })

  fireEvent.change(date(), { target: { value: '2026-11-14' } })

  expect(date()).toHaveValue('2026-11-14')
  expect(scrolled).toBe(0)
  expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent(
    'Saturday, November 14, 2026',
  )
  expect(screen.queryByRole('button', { name: /Standup/ })).not.toBeInTheDocument()
})

it('goes back to today with the Today button, scrolled or not', async () => {
  renderScreen('2026-11-14')
  await screen.findByRole('button', { name: /Planning/ })

  await userEvent.click(screen.getByRole('button', { name: 'Today' }))

  expect(date()).toHaveValue('2026-11-12')
  expect(screen.getAllByRole('heading', { level: 2 })[0]).toHaveTextContent('Thursday')
})

it('asks the server for the first months from the day it starts on, and from the day that is chosen', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  await vi.waitFor(() => {
    expect(listEvents).toHaveBeenCalledWith('/c/', { start: '2026-11-01', end: '2026-11-30' })
    expect(listEvents).toHaveBeenCalledWith('/c/', { start: '2027-01-01', end: '2027-01-31' }) // the third
  })
  expect(listEvents).not.toHaveBeenCalledWith('/c/', { start: '2027-11-01', end: '2027-11-30' }) // not the whole year

  fireEvent.change(date(), { target: { value: '2027-03-01' } })

  await vi.waitFor(() => {
    expect(listEvents).toHaveBeenCalledWith('/c/', { start: '2027-03-01', end: '2027-03-31' })
  })
})

it('does not list the events of the calendars that are hidden', async () => {
  serveEvents([
    event('Standup', { startTime: '09:00' }),
    event('Secret', { startDate: '2026-11-13', calendarUrl: '/hidden/' }),
  ])
  localStorage.setItem('capibara-calendar-hidden-calendars', JSON.stringify(['/hidden/']))
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(screen.queryByRole('button', { name: /Secret/ })).not.toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1) // the day of Secret is gone
})

it('has the separator of each day in the middle, with space above and below it, and less above the first one', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  const headings = screen.getAllByRole('heading', { level: 2 })
  expect(headings[0].parentElement).toHaveClass('[&>h2]:pt-2') // the first is near the top bar
  for (const heading of headings) expect(heading).toHaveClass('pt-6', 'pb-3', 'text-center')
})

it('says that nothing is planned, in the middle, when there is no event to list', async () => {
  serveEvents([])
  renderScreen()

  expect(await screen.findByText('Nothing planned')).toBeInTheDocument()
  expect(screen.getByText('The events that come will be here.')).toBeInTheDocument()
  expect(document.querySelector('[data-slot="empty-state"]')).toHaveClass('my-auto', 'text-center')
})

it('does not say that nothing is planned when there are events', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(screen.queryByText('Nothing planned')).not.toBeInTheDocument()
})

it('says it in Italian', async () => {
  await activateLocale('it')
  serveEvents([])
  renderScreen()

  expect(await screen.findByText('Niente in programma')).toBeInTheDocument()
  expect(screen.getByText('Gli eventi in arrivo compariranno qui.')).toBeInTheDocument()
})

it('has the color of the calendar as the left border of the title of each event', async () => {
  serveEvents([event('Standup', { startTime: '09:00', color: '#7c3aed' })])
  renderScreen()

  const standup = await screen.findByRole('button', { name: /Standup/ })

  expect(
    standup.querySelector<HTMLElement>('[data-slot="calendar-color"]')?.style.borderLeftColor,
  ).toBe('rgb(124, 58, 237)')
})
