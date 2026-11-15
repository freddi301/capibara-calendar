import { screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { CalendarEvent } from './legacy'
import AgendaScreen from '../screens/AgendaScreen'
import { renderApp } from './render'
import { serveEvents } from './server'

const event = (title: string, startDate: string): CalendarEvent => ({
  calendarUrl: '/c/',
  uid: title,
  url: `/c/${title}.ics`,
  ics: '',
  title,
  description: '',
  startDate,
  startTime: '',
  endDate: '',
  endTime: '',
})

beforeEach(() => {
  vi.setSystemTime(new Date('2026-11-12T10:00:00'))
  serveEvents([
    event('A', '2026-11-12'),
    event('B', '2026-11-12'),
    event('C', '2026-11-12'),
    event('D', '2026-11-13'),
  ])
})

afterEach(() => {
  vi.useRealTimers()
})

const handlers = {
  onCreate: vi.fn(),
  onEdit: vi.fn(),
  onOpenSettings: vi.fn(),
  onOpenLayouts: vi.fn(),
  onOpenView: vi.fn(),
  onOpenCalendars: vi.fn(),
  onOpenFilters: vi.fn(),
}

it('puts the events of a day in lanes: one on a phone, two on a tablet, three on a full desktop', async () => {
  renderApp(<AgendaScreen {...handlers} />)
  await screen.findByRole('button', { name: /A/ })

  const lanes = [...document.querySelectorAll('[data-slot="lanes"]')]
  expect(lanes).toHaveLength(2) // one for each day
  for (const day of lanes) {
    expect(day).toHaveClass('columns-1', 'md:columns-2', '2xl:columns-3')
  }
})

it('keeps the days one under the other, each with its title above its lanes', async () => {
  renderApp(<AgendaScreen {...handlers} />)
  await screen.findByRole('button', { name: /A/ })

  const days = [...document.querySelectorAll<HTMLElement>('[data-day]')]
  expect(days.map((day) => day.dataset.day)).toEqual(['2026-11-12', '2026-11-13'])
  expect(days[0].firstElementChild?.tagName).toBe('H2')
  expect(days[0].querySelectorAll('[data-slot="lanes"] button')).toHaveLength(3)
})
