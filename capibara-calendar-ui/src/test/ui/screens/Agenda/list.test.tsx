import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getApi } from '@/api'
import { activateLocale } from '@/i18n'
import { serveEvents, forRange, keyOf } from '@/test/server'
import { seedStored } from '@/test/support/stored'
import {
  date,
  dayGap,
  event,
  events,
  list,
  renderScreen,
  setUpAgenda,
  startOf,
} from '@/test/support/agenda'

let removeSizes: () => void

beforeEach(() => {
  removeSizes = setUpAgenda()
})

afterEach(() => {
  removeSizes()
  vi.useRealTimers()
})

it('lists the days with events, the earlier ones above today, each with its events', async () => {
  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  const days = screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)

  // then
  expect(days).toEqual([
    'Wednesday, November 11, 2026',
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
  ).toEqual(['Conference', 'Standup09:0009:30'])
})

it('shows a multi-day event on every day it covers, the days before today, and nothing far away', async () => {
  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(screen.getAllByRole('button', { name: /Conference/ })).toHaveLength(3)
  expect(screen.getByRole('button', { name: /Yesterday/ })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: /Far away/ })).not.toBeInTheDocument()
})

it('starts on the date it is given, with the days before it above', async () => {
  // when
  renderScreen('2026-11-14')
  await screen.findByRole('button', { name: /Planning/ })

  // then
  expect(list().scrollTop).toBe(startOf('2026-11-14') + dayGap)
  expect(screen.getByRole('button', { name: /Standup/ })).toBeInTheDocument()
})

it('opens an event, and the other screens, with the date it starts on', async () => {
  // given
  const { onCreate, onEdit, onOpenSettings, onOpenLayouts } = renderScreen('2026-11-14')

  // when
  await userEvent.click(await screen.findByRole('button', { name: /Planning/ }))
  await userEvent.click(screen.getByRole('button', { name: 'New event' }))
  await userEvent.click(screen.getByRole('button', { name: 'Layouts' }))
  await userEvent.click(screen.getByRole('button', { name: 'Settings' }))

  // then
  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ title: events[2].title }))
  expect(onCreate).toHaveBeenCalledExactlyOnceWith('2026-11-14')
  expect(onOpenLayouts).toHaveBeenCalledExactlyOnceWith('2026-11-14')
  expect(onOpenSettings).toHaveBeenCalledOnce()
})

it('is in the language of the app', async () => {
  // given
  await activateLocale('it')

  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(screen.getByRole('heading', { name: 'Giovedì 12 novembre 2026' })).toBeInTheDocument()
})

it('asks the server for the first months from the day it starts on, and from the day that is chosen', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  await vi.waitFor(() => {
    expect(getApi().listEvents).toHaveBeenCalledWith(
      ...forRange('/c/', {
        start: '2026-11-01',
        end: '2026-11-30',
      }),
    )
    expect(getApi().listEvents).toHaveBeenCalledWith(
      ...forRange('/c/', {
        start: '2027-01-01',
        end: '2027-01-31',
      }),
    ) // the third
  })
  expect(getApi().listEvents).not.toHaveBeenCalledWith(
    ...forRange('/c/', {
      start: '2027-11-01',
      end: '2027-11-30',
    }),
  ) // not the whole year

  // when
  fireEvent.change(date(), { target: { value: '2027-03-01' } })

  await vi.waitFor(() => {
    expect(getApi().listEvents).toHaveBeenCalledWith(
      ...forRange('/c/', {
        start: '2027-03-01',
        end: '2027-03-31',
      }),
    )
  })
})

it('does not list the events of the calendars that are hidden', async () => {
  // given
  serveEvents([
    event('Standup', { startTime: '09:00' }),
    event('Secret', { startDate: '2026-11-13', calendarUrl: '/hidden/' }),
  ])
  seedStored({ hiddenCalendars: [keyOf('/hidden/')] })

  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(screen.queryByRole('button', { name: /Secret/ })).not.toBeInTheDocument()
  expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(1) // the day of Secret is gone
})

it('has the separator of each day in the middle, with space above and below it, and less above the first one', async () => {
  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  const headings = screen.getAllByRole('heading', { level: 2 })

  // then
  expect(headings[0].parentElement).toHaveClass('pt-0') // the first is near the top bar
  for (const heading of headings) expect(heading).toHaveClass('border-b', 'text-center')
})

it('has the color of the calendar as the left border of the title of each event', async () => {
  // given
  serveEvents([event('Standup', { startTime: '09:00', color: '#7c3aed' })])

  // when
  renderScreen()

  const standup = await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(
    standup.querySelector<HTMLElement>('[data-slot="calendar-color"]')?.style.borderRightColor,
  ).toBe('rgb(124, 58, 237)')
})
