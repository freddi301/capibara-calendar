import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, vi } from 'vitest'
import App from '@/App'
import type { CalendarEvent } from '../legacy'
import { renderApp } from '../render'
import { serveEvents } from '../server'

export const ics = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:1',
  'SUMMARY:Standup',
  'DTSTART:20261105T080000Z',
  'DTEND:20261105T083000Z',
  'RRULE:FREQ=WEEKLY',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n')

// Today is Thursday 12 November 2026; the occurrence of the week before was on Monday 9.
export const standup: CalendarEvent = {
  uid: '1',
  calendarUrl: '/personal/',
  url: '/personal/1.ics',
  ics,
  title: 'Standup',
  description: '',
  startDate: '2026-11-12',
  startTime: '09:00',
  endDate: '2026-11-12',
  endTime: '09:30',
  isRecurring: true,
  occurrenceId: '20261112T080000Z',
}

/** The app on Thursday 12 November 2026, with the standup that repeats every week. */
export function setUpRepeat() {
  vi.setSystemTime(new Date('2026-11-12T10:00:00'))
  serveEvents([standup], [{ url: '/personal/', name: 'Personal', color: '#2563eb' }])
}

/** The agenda has the occurrences of the weeks around: the one of today is in the section of its day. */
export async function standupOnThe12th() {
  const day = await waitFor(() => {
    const found = document.querySelector<HTMLElement>('[data-day="2026-11-12"]')
    if (!found) throw new Error('the day is not there yet')
    return found
  })
  return within(day).findByRole('button', { name: /Standup/ })
}

/** The event is looked at first: which of its events to change is asked when the change begins. */
export async function openOccurrence(
  choice?: 'Only this event' | 'This and following' | 'All events',
) {
  renderApp(<App />)
  await userEvent.click(await standupOnThe12th())
  await userEvent.click(await screen.findByRole('button', { name: /^(Edit|Modifica)$/ }))
  if (choice) await userEvent.click(await screen.findByRole('button', { name: choice }))
}

async function chooseClosing(select: string, option: string) {
  await userEvent.click(await screen.findByRole('combobox', { name: select }))
  await userEvent.click(await screen.findByRole('option', { name: option }))
  await waitFor(() => {
    expect(screen.queryByRole('option')).not.toBeInTheDocument() // it is closed
  })
}

export const chooseRepeat = (option: string) => chooseClosing('Repeat', option)

export const chooseEnding = (option: string) => chooseClosing('How the repeat ends', option)
