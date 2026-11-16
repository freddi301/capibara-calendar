import type { CalendarEvent } from './legacy'
import { getApi } from '../api'
import { act, fireEvent, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, vi } from 'vitest'
import WeekRowsScreen from '../screens/WeekRowsScreen'
import { renderApp } from './render'
import { serveEvents } from './server'

// What the tests of dragging the cards of the week rows have in common.

const weekly = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:Weekly sync',
  'SUMMARY:Weekly sync',
  'DTSTART:20261105T100000Z',
  'DTEND:20261105T103000Z',
  'RRULE:FREQ=WEEKLY',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n')

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
  event('Weekly sync', {
    startTime: '11:00',
    endTime: '11:30',
    ics: weekly,
    isRecurring: true,
    occurrenceId: '20261112T100000Z',
  }),
]

// jsdom has no layout: the rows are 100 px high, one under the other, and the cards are in them.
// The first page of the pager is the week before, so the rows of the week that is shown start at 7.
function layOut() {
  return vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: Element,
  ) {
    if (this.matches('[data-slot="pager"]')) return new DOMRect(0, 0, 800, 700)
    const rows = [...document.querySelectorAll('[role="group"][aria-label]')]
    const row = this.closest('[role="group"][aria-label]')
    if (!row) return new DOMRect(0, 0, 0, 0)
    const top = (rows.indexOf(row) - 7) * 100
    if (this === row) return new DOMRect(0, top, 800, 100)
    if (this.matches('button:not([aria-pressed]):not([data-side])')) {
      return new DOMRect(60, top + 10, 200, 80)
    }
    return new DOMRect(60, top, 700, 100)
  })
}

/** Today, the events of the week and the layout of the rows, for each test of the file. */
export function setUpWeekDrag() {
  let rectangles: ReturnType<typeof layOut>
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-11-12T10:00:00'))
    localStorage.setItem('capibara-calendar-settings', JSON.stringify({ weekStart: 'monday' }))
    serveEvents(events)
    rectangles = layOut()
  })
  afterEach(() => {
    rectangles.mockRestore()
    vi.useRealTimers()
  })
}

export function renderScreen() {
  const onEdit = vi.fn()
  renderApp(
    <WeekRowsScreen
      onCreate={vi.fn()}
      onEdit={onEdit}
      onOpenSettings={vi.fn()}
      onOpenLayouts={vi.fn()}
      onOpenCalendars={vi.fn()}
      onOpenFilters={vi.fn()}
      onOpenView={vi.fn()}
    />,
  )
  return { onEdit, update: vi.spyOn(getApi(), 'updateEvent') }
}

export const row = (name: RegExp) => screen.getByRole('group', { name })
const cardsOf = (name: RegExp) =>
  within(row(name))
    .queryAllByRole('button')
    .filter((button) => !button.hasAttribute('aria-pressed') && !button.hasAttribute('data-side'))
export const titlesOf = (name: RegExp) => cardsOf(name).map((card) => card.textContent)
export const cardIn = (name: RegExp, title: RegExp) =>
  within(row(name)).findByRole('button', { name: title })
export const ghost = () => document.querySelector('[data-slot="drop-ghost"]')
export const lifted = () => document.querySelector('[data-slot="lifted-card"]')

// The middle of a row, by its place in the week: Monday is 0.
export const rowY = (day: number) => day * 100 + 50
export const dayRows = {
  monday: /Monday, November 9/,
  tuesday: /Tuesday, November 10/,
  wednesday: /Wednesday, November 11/,
  thursday: /Thursday, November 12/,
  friday: /Friday, November 13/,
}

const point = (y: number, x = 150) => ({ clientX: x, clientY: y })
export const settle = () => act(() => Promise.resolve())
export const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)))

/** Presses a card with the mouse and moves it, a few pixels at first, to a place. */
export async function dragTo(element: HTMLElement, from: number, to: number) {
  fireEvent.mouseDown(element, { button: 0, ...point(from) })
  act(() => {
    fireEvent.mouseMove(document, point(from + 8))
  })
  // The days are measured a moment after the card is picked up.
  await wait(40)
  await moveTo(to)
}

/** Moves the pointer on, and gives the days a moment to know that it is on one of them. */
export async function moveTo(y: number) {
  act(() => {
    fireEvent.mouseMove(document, point(y))
  })
  await wait(40)
  act(() => {
    fireEvent.mouseMove(document, point(y + 1))
  })
}

export const release = (y: number) => {
  act(() => {
    fireEvent.mouseUp(document, point(y))
  })
}

/** Presses a card with a finger, and holds it for the long press, then moves it. */
export async function touchTo(element: HTMLElement, from: number, to: number) {
  fireEvent.touchStart(element, { touches: [point(from)] })
  await wait(450)
  act(() => {
    fireEvent.touchMove(element, { touches: [point(from + 8)] })
  })
  await wait(40)
  act(() => {
    fireEvent.touchMove(element, { touches: [point(to)] })
  })
  await wait(40)
  act(() => {
    fireEvent.touchMove(element, { touches: [point(to + 1)] })
  })
}

export const touchEnd = (element: HTMLElement, y: number) => {
  act(() => {
    fireEvent.touchEnd(element, { changedTouches: [point(y)] })
  })
}
