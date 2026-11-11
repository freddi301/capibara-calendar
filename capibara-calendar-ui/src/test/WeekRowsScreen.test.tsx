import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { activateLocale } from '../i18n'
import { listEvents, type CalendarEvent } from '../lib/caldav'
import WeekRowsScreen from '../screens/WeekRowsScreen'
import { renderApp } from './render'

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

// Today is Thursday 12 November 2026. The week runs from Monday 9 to Sunday 15.
const events = [
  event('Standup', { startTime: '09:00', endTime: '09:30' }),
  event('Conference', { endDate: '2026-11-14' }),
  event('Release', { startTime: '16:00' }),
  event('Gym', { startTime: '18:00', endTime: '19:00' }),
  event('Planning', { startDate: '2026-11-16' }),
]

const storeSettings = (settings: object) => {
  localStorage.setItem('capibara-calendar-settings', JSON.stringify(settings))
}

beforeEach(() => {
  vi.setSystemTime(new Date('2026-11-12T10:00:00'))
  vi.mocked(listEvents).mockResolvedValue(events)
  storeSettings({ weekStart: 'monday' })
})

afterEach(() => {
  vi.useRealTimers()
})

function renderScreen(date?: string) {
  const handlers = {
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenLayouts: vi.fn(),
  }
  renderApp(<WeekRowsScreen date={date} {...handlers} />)
  return handlers
}

const row = (name: RegExp) => screen.getByRole('group', { name })
const swipe = (from: number, to: number) => {
  const area = screen.getAllByRole('group')[0].parentElement as HTMLElement
  fireEvent.pointerDown(area, { clientX: from, clientY: 100 })
  fireEvent.pointerUp(area, { clientX: to, clientY: 100 })
}

it('shows the seven days of the week as rows', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  const rows = within(row(/Monday, November 9/).parentElement as HTMLElement).getAllByRole('group')
  expect(rows.map((item) => item.getAttribute('aria-label'))).toEqual([
    'Monday, November 9, 2026',
    'Tuesday, November 10, 2026',
    'Wednesday, November 11, 2026',
    'Thursday, November 12, 2026',
    'Friday, November 13, 2026',
    'Saturday, November 14, 2026',
    'Sunday, November 15, 2026',
  ])
  expect(row(/Thursday/)).toHaveTextContent('Thu12')
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-12')
})

it('shows the events of each day as cards, with the time above the title', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  const cards = within(row(/Thursday/)).getAllByRole('button')
  expect(cards.map((card) => card.textContent)).toEqual([
    'Conference',
    '9:00 AM–9:30 AMStandup',
    '4:00 PMRelease',
    '6:00 PM–7:00 PMGym',
  ])
  expect(within(row(/Friday/)).getAllByRole('button')).toHaveLength(1) // Conference goes on
})

it('leaves the days with nothing planned empty, without a word about it', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(within(row(/Monday/)).queryAllByRole('button')).toHaveLength(0)
  expect(row(/Monday/)).toHaveTextContent(/^Mon9$/) // only the day, no text about the lack of events
})

it('has two cards across, the others scrolled to sideways, without saying so', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  const thursday = within(row(/Thursday/)).getAllByRole('button')
  expect(thursday).toHaveLength(4)
  expect(thursday[0].parentElement).toHaveClass('overflow-x-auto', '[&::-webkit-scrollbar]:hidden')
  for (const card of thursday) expect(card).toHaveClass('basis-[calc((100%-0.375rem)/2)]')
  expect(screen.queryByText(/more/i)).not.toBeInTheDocument()
})

it('gives every card the height of its row, whatever the number of cards', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // The cards are stretched by the row: not one of them has a height of its own.
  const cards = screen.getAllByRole('button', { name: /Conference|Standup|Release|Gym/ })
  expect(cards.length).toBeGreaterThan(3)
  for (const card of cards) {
    expect(card).toHaveClass('h-auto')
    expect(card.parentElement).toHaveClass('items-stretch')
  }
})

it('edits an event from its card', async () => {
  const { onEdit } = renderScreen()

  await userEvent.click(await screen.findByRole('button', { name: /Standup/ }))

  expect(onEdit).toHaveBeenCalledWith(events[0])
})

it('goes to the next week with a swipe to the left, and to the one before with a swipe to the right', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  swipe(300, 100)
  expect(await screen.findByRole('button', { name: /Planning/ })).toBeInTheDocument()
  expect(row(/Monday, November 16/)).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-19')

  swipe(100, 300)
  swipe(100, 300)
  expect(row(/Monday, November 2/)).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-05')
})

it('does not take a short or a mostly vertical move for a swipe', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  const area = screen.getAllByRole('group')[0].parentElement as HTMLElement

  swipe(200, 180)
  fireEvent.pointerDown(area, { clientX: 200, clientY: 100 })
  fireEvent.pointerUp(area, { clientX: 100, clientY: 400 })

  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-12')
})

it('creates an event and opens the layouts with the selected day', async () => {
  const { onCreate, onOpenLayouts } = renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  swipe(300, 100)

  await userEvent.click(screen.getByRole('button', { name: 'New event' }))
  await userEvent.click(screen.getByRole('button', { name: 'Layouts' }))

  expect(onCreate).toHaveBeenCalledExactlyOnceWith('2026-11-19')
  expect(onOpenLayouts).toHaveBeenCalledExactlyOnceWith('2026-11-19')
})

it('starts on the date it is given, and goes back to today', async () => {
  renderScreen('2026-12-25')
  await screen.findByRole('group', { name: /Friday, December 25/ })

  await userEvent.click(screen.getByRole('button', { name: 'Today' }))

  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-12')
  expect(row(/Thursday, November 12/)).toBeInTheDocument()
})

it('reports when the server cannot be reached', async () => {
  vi.mocked(listEvents).mockRejectedValue(new Error('offline'))
  renderScreen()

  expect(await screen.findByText('Cannot reach the CalDAV server')).toBeInTheDocument()
})

it('is in the language of the app, with the times of the habit of it', async () => {
  await activateLocale('it')
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(row(/giovedì 12 novembre 2026/)).toHaveTextContent('Gio12')
  expect(within(row(/giovedì/)).getAllByRole('button')[1]).toHaveTextContent('09:00–09:30Standup')
})
