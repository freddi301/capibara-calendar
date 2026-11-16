import type { CalendarEvent } from './legacy'
import { getApi } from '../api'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { activateLocale } from '../i18n'
import DaysScreen from '../screens/DaysScreen'
import { pagerOf, scrollToPage } from './pager'
import { renderApp } from './render'
import { serveEvents, forRange } from './server'
import { seedStored } from './support/stored'

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

// Today is Thursday 12 November 2026. With weeks starting on Monday, the table runs from
// Monday 26 October to Sunday 6 December, six weeks.
const events = [
  event('Standup', { startTime: '09:00', endTime: '09:30' }),
  event('Conference', { endDate: '2026-11-14' }),
  event('Planning', { startDate: '2026-11-16' }),
  event('Cleanup', { startDate: '2026-10-28' }), // in the table, but in October
  event('Big', { startDate: '2026-11-20' }),
  ...Array.from({ length: 100 }, (_, index) => event(`Busy ${index}`, { startDate: '2026-11-21' })),
]

const storeSettings = (settings: object) => {
  seedStored({ settings })
}

beforeEach(() => {
  seedStored({ daysMode: 'month' }) // the month is above the days
  vi.setSystemTime(new Date('2026-11-12T10:00:00'))
  serveEvents(events)
  storeSettings({ weekStart: 'monday' })
})

afterEach(() => {
  vi.useRealTimers()
})

const month = () => within(screen.getByRole('group', { name: 'Month' })).getAllByRole('button')
const day = (label: RegExp) => screen.getByRole('button', { name: label })

function renderScreen() {
  const handlers = {
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenLayouts: vi.fn(),
    onOpenCalendars: vi.fn(),
    onOpenFilters: vi.fn(),
    onOpenView: vi.fn(),
  }
  renderApp(<DaysScreen {...handlers} />)
  return handlers
}

it('shows the weeks of the month, with the days of the months around it', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  const days = month()
  expect(days).toHaveLength(42)
  expect(days[0]).toHaveAccessibleName(/^Monday, October 26, 2026/)
  expect(days[41]).toHaveAccessibleName(/^Sunday, December 6, 2026/)
  expect(day(/Thursday, November 12/)).toHaveAttribute('aria-pressed', 'true')
  expect(day(/Thursday, November 12/)).toHaveAttribute('aria-current', 'date')
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-12')
})

it('always has six weeks, with the days of the month after, so that the table has the same height', async () => {
  storeSettings({ weekStart: 'sunday' }) // November 2026 needs five weeks: 1 to 30
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(month()).toHaveLength(42)
  expect(month()[0]).toHaveAccessibleName(/^Sunday, November 1, 2026/)
  expect(month()[41]).toHaveAccessibleName(/^Saturday, December 12, 2026/)
})

it('names the weekdays once, above the table', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  const header = screen.getByText('Mon').parentElement as HTMLElement
  expect(header).toHaveTextContent('MonTueWedThuFriSatSun')
  expect(screen.getAllByText('Mon')).toHaveLength(1)
})

it('counts the events of each day, on the corner of the number', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  const busy = day(/Thursday, November 12, 2026: 2 events/)
  expect(within(busy).getByText('2').parentElement).toHaveClass('absolute', '-top-1.5', 'left-full')
  expect(day(/Friday, November 13, 2026: 1 event$/)).toBeInTheDocument()
  expect(day(/Tuesday, November 10, 2026$/)).toBeInTheDocument() // nothing planned: no count
  expect(within(day(/Tuesday, November 10, 2026$/)).queryByText('0')).not.toBeInTheDocument()
  expect(within(day(/Saturday, November 21, 2026/)).getByText('99+')).toBeInTheDocument()
  expect(day(/Wednesday, October 28, 2026: 1 event/)).toBeInTheDocument() // the month before
})

it('shows the events of a day when it is tapped, in the month before too', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  await userEvent.click(day(/Saturday, November 14/))
  expect(screen.getByRole('button', { name: /Conference/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Standup/ })).not.toBeInTheDocument()

  await userEvent.click(day(/Wednesday, October 28/))
  expect(await screen.findByRole('button', { name: /Cleanup/ })).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-10-28')
  expect(screen.getByRole('combobox', { name: 'Month: October' })).toBeInTheDocument()
  expect(month()[0]).toHaveAccessibleName(/^Monday, September 28, 2026/) // the table moved
})

it('follows the month that is picked from the list', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  await userEvent.click(screen.getByRole('combobox', { name: /^Month/ }))
  await userEvent.click(await screen.findByRole('option', { name: 'December' }))

  expect(month()[0]).toHaveAccessibleName(/^Monday, November 30, 2026/)
  expect(day(/Saturday, December 12/)).toHaveAttribute('aria-pressed', 'true')
})

it('goes back to today with the Today button', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  await userEvent.click(day(/Saturday, November 14/))

  await userEvent.click(screen.getByRole('button', { name: 'Today' }))

  expect(day(/Thursday, November 12/)).toHaveAttribute('aria-pressed', 'true')
})

it('opens the layouts with the selected day', async () => {
  const { onOpenLayouts } = renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  await userEvent.click(day(/Saturday, November 14/))
  await userEvent.click(screen.getByRole('button', { name: 'Layouts' }))

  expect(onOpenLayouts).toHaveBeenCalledExactlyOnceWith('2026-11-14')
})

it('starts on the date it is given', async () => {
  renderApp(
    <DaysScreen
      date="2026-12-25"
      onCreate={vi.fn()}
      onEdit={vi.fn()}
      onOpenSettings={vi.fn()}
      onOpenLayouts={vi.fn()}
      onOpenCalendars={vi.fn()}
      onOpenFilters={vi.fn()}
      onOpenView={vi.fn()}
    />,
  )

  expect(await screen.findByRole('combobox', { name: 'Month: December' })).toBeInTheDocument()
  expect(day(/Friday, December 25/)).toHaveAttribute('aria-pressed', 'true')
})

it('is in the language of the app', async () => {
  await activateLocale('it')
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(screen.getByRole('group', { name: 'Mese' })).toBeInTheDocument()
  expect(screen.getByText('Lun')).toBeInTheDocument()
  expect(day(/giovedì 12 novembre 2026: 2 eventi/)).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Visualizzazioni' })).toBeInTheDocument()
})

const monthPager = () => pagerOf(screen.getByRole('group', { name: 'Month' }))
const swipe = (direction: 'next' | 'previous') =>
  scrollToPage(monthPager(), 'y', direction === 'next' ? 2 : 0)

it('has the month before and the month after above and below the month', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(monthPager().children).toHaveLength(3)
  expect(screen.getAllByRole('group', { name: 'Month' })).toHaveLength(1) // the one that is shown
  const hidden = screen.getAllByRole('button', { name: /Friday, October 2, 2026/, hidden: true })
  expect(hidden[0].closest('[aria-hidden="true"]')).not.toBeNull()
  expect(monthPager()).toHaveClass('h-57.5') // the pages of the same height
})

it('goes to the next month when it stops on it, and to the month before when it stops on that', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  await swipe('next')
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-12-12') // the same day
  expect(screen.getByRole('combobox', { name: 'Month: December' })).toBeInTheDocument()

  await swipe('previous')
  await swipe('previous')
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-10-12')
  expect(screen.getByRole('combobox', { name: 'Month: October' })).toBeInTheDocument()
})

it('keeps the day within the month when it goes to a shorter one', async () => {
  vi.setSystemTime(new Date('2026-01-31T10:00:00'))
  renderScreen()
  await screen.findByRole('status')

  await swipe('next')

  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-02-28')
})

it('asks the server for the months that the three tables touch, and only for the next one after it moves', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  await vi.waitFor(() => {
    // October, November and December in six weeks each, and the months they touch
    expect(
      vi
        .mocked(getApi().listEvents)
        .mock.calls.map(([, range]) => range.start)
        .sort(),
    ).toEqual(['2026-09-01', '2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01'])
  })

  await swipe('next')

  await vi.waitFor(() => {
    expect(getApi().listEvents).toHaveBeenCalledTimes(6)
  })
  expect(getApi().listEvents).toHaveBeenLastCalledWith(
    ...forRange('/c/', {
      start: '2027-02-01',
      end: '2027-02-28',
    }),
  )
})
