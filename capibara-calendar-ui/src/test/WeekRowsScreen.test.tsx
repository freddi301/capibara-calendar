import type { CalendarEvent } from './legacy'
import { getApi } from '../api'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { activateLocale } from '../i18n'
import WeekRowsScreen from '../screens/WeekRowsScreen'
import { pagerOf, scrollToPage } from './pager'
import { renderApp } from './render'
import { serveEvents, keyOf } from './server'

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
  serveEvents(events)
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
    onOpenCalendars: vi.fn(),
    onOpenFilters: vi.fn(),
    onOpenView: vi.fn(),
  }
  renderApp(<WeekRowsScreen date={date} {...handlers} />)
  return handlers
}

const row = (name: RegExp) => screen.getByRole('group', { name })
// The buttons of a row that are cards: not the one of the day, and not the ones that scroll it.
const cardsOf = (name: RegExp) =>
  within(row(name))
    .queryAllByRole('button')
    .filter((button) => !button.hasAttribute('aria-pressed') && !button.hasAttribute('data-side'))
const rowsPager = () => pagerOf(screen.getAllByRole('group')[0])
const swipe = (direction: 'next' | 'previous') =>
  scrollToPage(rowsPager(), 'y', direction === 'next' ? 2 : 0)

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
  expect(row(/Thursday/)).toHaveTextContent('Thu 12')
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-12')
})

it('shows the events of each day as cards, with the time above the title', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  const cards = cardsOf(/Thursday/)
  expect(cards.map((card) => card.textContent)).toEqual([
    'Conference',
    '09:00–09:30Standup',
    '16:00Release',
    '18:00–19:00Gym',
  ])
  expect(cardsOf(/Friday/)).toHaveLength(1) // Conference goes on
})

it('leaves the days with nothing planned empty, without a word about it', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(cardsOf(/Monday/)).toHaveLength(0)
  expect(row(/Monday/)).toHaveTextContent(/^Mon 9$/) // only the day, no text about the lack of events
})

it('has two cards across, the others scrolled to sideways, without saying so', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  const thursday = cardsOf(/Thursday/)
  expect(thursday).toHaveLength(4)
  expect(thursday[0].parentElement?.parentElement).toHaveClass(
    'overflow-x-auto',
    '[&::-webkit-scrollbar]:hidden',
  )
  for (const card of thursday)
    expect(card.className).toContain(
      'basis-[calc((100%-(var(--cards,2)-1)*0.375rem)/var(--cards,2))]',
    )
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
    expect(card.parentElement?.parentElement).toHaveClass('items-stretch')
  }
})

it('edits an event from its card', async () => {
  const { onEdit } = renderScreen()

  await userEvent.click(await screen.findByRole('button', { name: /Standup/ }))

  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ title: events[0].title }))
})

it('has the week before and the week after above and below the week, for what is scrolled to', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(rowsPager().children).toHaveLength(3)
  expect(rowsPager()).toHaveClass('snap-y')
  const hidden = screen.getAllByRole('group', { name: /Monday, November 16, 2026/, hidden: true })
  expect(hidden[0].closest('[aria-hidden="true"]')).not.toBeNull() // the next week, below
  expect(screen.queryByRole('group', { name: /Monday, November 16, 2026/ })).not.toBeInTheDocument()
})

it('goes to the next week when it stops on it, and to the week before when it stops on that', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  await swipe('next')
  expect(await screen.findByRole('button', { name: /Planning/ })).toBeInTheDocument()
  expect(row(/Monday, November 16/)).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-19')

  await swipe('previous')
  await swipe('previous')
  expect(row(/Monday, November 2/)).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-05')
})

it('stays on the week when it stops on the page that is shown', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  await scrollToPage(rowsPager(), 'y', 1)

  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-12')
})

it('creates an event and opens the layouts with the selected day', async () => {
  const { onCreate, onOpenLayouts } = renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  await swipe('next')

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

it('is in the language of the app, with the times of the habit of it', async () => {
  await activateLocale('it')
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(row(/giovedì 12 novembre 2026/)).toHaveTextContent('Gio 12')
  expect(cardsOf(/giovedì/)[1]).toHaveTextContent('09:00–09:30Standup')
})

const starts = () =>
  vi
    .mocked(getApi().listEvents)
    .mock.calls.map(([, range]) => range.start)
    .sort()

it('asks the server for the month of the weeks that it shows, and the months beside it', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  await vi.waitFor(() => {
    expect(starts()).toEqual([
      '2026-10-01', // the month before
      '2026-11-01', // the month of the week
      '2026-12-01', // the month after
    ])
  })
})

it('does not show the events of the calendars that are hidden', async () => {
  serveEvents([
    event('Standup', { startTime: '09:00' }),
    event('Secret', { calendarUrl: '/hidden/' }),
  ])
  localStorage.setItem('capibara-calendar-hidden-calendars', JSON.stringify([keyOf('/hidden/')]))
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(screen.queryByRole('button', { name: /Secret/ })).not.toBeInTheDocument()
})

it('lets the title break anywhere, even in a word, and shows up to three lines of it', async () => {
  serveEvents([event('Averyveryverylongwordwithoutspaces', { startDate: '2026-11-13' })])
  renderScreen()

  const card = await screen.findByRole('button', { name: /Averyvery/ })
  expect(within(card).getByText(/Averyvery/)).toHaveClass('wrap-anywhere', 'line-clamp-3')
})

it('has the color of the calendar as the left border of the card', async () => {
  serveEvents([event('Standup', { startTime: '09:00', color: '#16a34a' }), event('Plain', {})])
  renderScreen()
  const standup = await screen.findByRole('button', { name: /Standup/ })

  expect(standup.style.borderRightColor).toBe('rgb(22, 163, 74)')
  expect(standup).toHaveClass('border-r-4')
  const plain = screen.getByRole('button', { name: /Plain/ })
  expect(plain.style.borderRightColor).toBe('')
  expect(plain).not.toHaveClass('border-r-4')
})

it('opens a new event for the day when the empty space of its row is pressed', async () => {
  const { onCreate } = renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // Tuesday has nothing planned: the whole of its row is empty space.
  await userEvent.click(row(/Tuesday/).querySelector('[role="presentation"]') as HTMLElement)
  expect(onCreate).toHaveBeenLastCalledWith('2026-11-10')

  // Thursday has cards: the space that is left, beside them, is the same.
  await userEvent.click(row(/Thursday/).querySelector('[role="presentation"]') as HTMLElement)
  expect(onCreate).toHaveBeenLastCalledWith('2026-11-12')
  expect(onCreate).toHaveBeenCalledTimes(2)
})

it('opens the event, and not a new one, when a card is pressed', async () => {
  const { onCreate, onEdit } = renderScreen()
  const standup = await screen.findByRole('button', { name: /Standup/ })

  await userEvent.click(standup)

  expect(onEdit).toHaveBeenCalledOnce()
  expect(onCreate).not.toHaveBeenCalled()
})
