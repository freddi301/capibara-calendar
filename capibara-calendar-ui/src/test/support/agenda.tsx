import { fireEvent, screen } from '@testing-library/react'
import { vi } from 'vitest'
import AgendaScreen from '@/screens/AgendaScreen'
import type { CalendarEvent } from '@/test/legacy'
import { renderApp } from '@/test/render'
import { serveEvents } from '@/test/server'
import { giveSizes } from '@/test/virtual'

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

// Today is Thursday 12 November 2026.
export const events = [
  event('Standup', { startTime: '09:00', endTime: '09:30' }),
  event('Conference', { endDate: '2026-11-14' }),
  event('Planning', { startDate: '2026-11-16' }),
  event('Yesterday', { startDate: '2026-11-11' }),
  event('Far away', { startDate: '2028-01-01' }),
]

/**
 * The agenda on Thursday 12 November 2026, with the events above, and every day 100 high.
 * Motion is reduced, so that the list lands on a chosen day at once, and not over time.
 * Gives back what takes it away.
 */
export function setUpAgenda(served = events) {
  vi.setSystemTime(new Date('2026-11-12T10:00:00'))
  serveEvents(served)
  vi.mocked(window.matchMedia).mockImplementation(
    (query) =>
      ({
        matches: query.includes('prefers-reduced-motion'),
        media: query,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }) as unknown as MediaQueryList,
  )
  const removeSizes = giveSizes()
  return () => {
    removeSizes()
    vi.mocked(window.matchMedia).mockReset()
  }
}

export function renderScreen(date?: string) {
  const handlers = {
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenLayouts: vi.fn(),
    onOpenCalendars: vi.fn(),
    onOpenFilters: vi.fn(),
    onOpenView: vi.fn(),
  }
  renderApp(<AgendaScreen date={date} {...handlers} />)
  return handlers
}

export const dayGap = 16 // the space above the heading of each day, but the first

export const list = () => document.querySelector<HTMLElement>('[data-vt="events"]') as HTMLElement
const row = (day: string) => list().querySelector<HTMLElement>(`[data-day="${day}"]`) as HTMLElement
// jsdom has no layout: the rows are placed by the list, each one 100 high (see giveSizes).
export const startOf = (day: string) =>
  Number(/translateY\((-?[\d.]+)px/.exec(row(day).style.transform)?.[1])

export function scrollList(scrollTop: number) {
  Object.defineProperty(list(), 'scrollTop', {
    value: scrollTop,
    writable: true,
    configurable: true,
  })
  fireEvent.wheel(list()) // the user is scrolling, the list is not landing any more
  fireEvent.scroll(list())
}

export const date = () => screen.getByLabelText('Choose a date')
