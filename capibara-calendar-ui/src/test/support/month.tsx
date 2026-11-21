import { afterEach, beforeEach, vi } from 'vitest'
import MonthScreen from '@/screens/MonthScreen'
import { matchMediaMock } from '@/test/mocks/match-media'
import type { CalendarEvent } from '@/test/legacy'
import { renderApp } from '@/test/render'
import { serveEvents } from '@/test/server'
import { seedStored } from '@/test/support/stored'

// What the tests of the month table have in common.

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

const meetings = Array.from({ length: 8 }, (_, index) =>
  event(`Meeting ${index + 1}`, {
    startDate: '2026-11-17',
    startTime: `${String(8 + index).padStart(2, '0')}:00`,
  }),
)

const reviews = Array.from({ length: 6 }, (_, index) =>
  event(`Review ${index + 1}`, {
    startDate: '2026-11-20',
    startTime: `${String(8 + index).padStart(2, '0')}:00`,
  }),
)

// Today is Thursday 12 November 2026. The 17th has 8 events, the 20th has 6 and the 24th has 1.
const events = [
  event('Standup', { startTime: '09:00', endTime: '09:30' }),
  event('Conference', { endDate: '2026-11-14' }),
  event('Release', { startTime: '16:00' }),
  ...meetings,
  ...reviews,
  event('Solo', { startDate: '2026-11-24' }),
]

/** Says whether the screen is big enough for the month table: it is not, if nothing says it is. */
export function setScreenSize(isRoomy: boolean) {
  matchMediaMock.mockImplementation((query: string) => ({
    matches: isRoomy && query.includes('min-width'),
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

/** Today, the events, the first day of the week and a screen that is big, for each test of the file. */
export function setUpMonth(served = events) {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-11-12T10:00:00'))
    serveEvents(served)
    seedStored({ settings: { weekStart: 'monday' } })
    setScreenSize(true)
  })
  afterEach(() => {
    vi.useRealTimers()
    setScreenSize(false)
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
  renderApp(<MonthScreen date={date} {...handlers} />)
  return handlers
}
