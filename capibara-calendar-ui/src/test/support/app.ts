import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { resetApi, setApi } from '@/api'
import { checkCaldav } from '@/api/sources'
import { primaryConnectionId, saveConnectionOf } from '@/lib/connection'
import type { CalendarEvent } from '../legacy'
import { serveEvents } from '../server'

export const dentist: CalendarEvent = {
  uid: '1',
  calendarUrl: '/personal/',
  url: '/dev/calendar/1.ics',
  ics: '',
  title: 'Dentist',
  description: 'Bring the forms',
  startDate: '2026-11-12',
  startTime: '',
  endDate: '',
  endTime: '',
}

export const calendars = [
  { url: '/personal/', name: 'Personal', color: '#2563eb' },
  { url: '/work/', name: 'Work', color: '#dc2626' },
]

/**
 * The app as it is for a person with a server connected, on a Thursday, with one event on it. The
 * test file mocks `@/api` (`resetApi`) and `@/api/sources` (`checkCaldav`).
 */
export function setUpApp() {
  saveConnectionOf(primaryConnectionId, {
    url: 'https://caldav.example/dav/',
    username: 'user',
    password: 'secret',
  })
  vi.setSystemTime(new Date('2026-11-12T10:00:00')) // a Thursday; the home screen shows today
  serveEvents([dentist], calendars)
  vi.mocked(checkCaldav).mockResolvedValue()
  vi.mocked(resetApi).mockImplementation(() => {
    setApi(undefined) // the next request is to the servers that are saved
  })
}

export async function openCreateScreen() {
  await userEvent.click(await screen.findByRole('button', { name: 'New event' }))
}

export async function openSettings() {
  await userEvent.click(await screen.findByRole('button', { name: 'Settings' }))
}

export async function choose(select: string, option: string | RegExp) {
  await userEvent.click(screen.getByRole('combobox', { name: select }))
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

export async function chooseLayout(name: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Layouts' }))
  await userEvent.click(screen.getByRole('button', { name }))
}
