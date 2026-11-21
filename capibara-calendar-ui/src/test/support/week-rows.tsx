import { screen, within } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import WeekRowsScreen from '@/screens/WeekRowsScreen'
import type { CalendarEvent } from '@/test/legacy'
import { pagerOf } from '@/test/pager'
import { renderApp } from '@/test/render'
import { serveEvents } from '@/test/server'
import { seedStored } from '@/test/support/stored'

// What the tests of the week rows have in common.

export function event(title: string, fields: Partial<CalendarEvent>): CalendarEvent {
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
export const events = [
  event('Standup', { startTime: '09:00', endTime: '09:30' }),
  event('Conference', { endDate: '2026-11-14' }),
  event('Release', { startTime: '16:00' }),
  event('Gym', { startTime: '18:00', endTime: '19:00' }),
  event('Planning', { startDate: '2026-11-16' }),
]

/** Today, the events and the first day of the week, for each test of the file. */
export function setUpWeekRows(served = events) {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-11-12T10:00:00'))
    serveEvents(served)
    seedStored({ settings: { weekStart: 'monday' } })
  })
  afterEach(() => {
    vi.useRealTimers()
  })
}

export function renderScreen(date?: string) {
  const handlers = {
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenLayouts: vi.fn(),
    onChooseLayout: vi.fn(),
    onOpenCalendars: vi.fn(),
    onOpenFilters: vi.fn(),
    onOpenView: vi.fn(),
  }
  renderApp(<WeekRowsScreen date={date} {...handlers} />)
  return handlers
}

export const row = (name: RegExp) => screen.getByRole('group', { name })

// The buttons of a row that are cards: not the one of the day, and not the ones that scroll it.
export const cardsOf = (name: RegExp) =>
  within(row(name))
    .queryAllByRole('button')
    .filter((button) => !button.hasAttribute('aria-pressed') && !button.hasAttribute('data-side'))

/** What a card says, as it is read: the time and its duration, then the title. */
export const titlesOf = (name: RegExp) => cardsOf(name).map((card) => card.textContent)

export const rowsPager = () => pagerOf(screen.getAllByRole('group')[0])

// What the cards say, for the events of the tests.
export const standupText = '09:00–09:30 30 minStandup'
export const conferenceText = '3 daysConference'
