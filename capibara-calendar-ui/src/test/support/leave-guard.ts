import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, vi } from 'vitest'
import { checkCaldav } from '@/api/sources'
import { primaryConnectionId, saveConnectionOf } from '@/lib/connection'
import type { CalendarEvent, CalendarInfo } from '../legacy'
import { serveEvents } from '../server'

export const work: CalendarInfo = { url: '/work/', name: 'Work', color: '#dc2626' }

export const dentistAtWork: CalendarEvent = {
  uid: '1',
  calendarUrl: '/work/',
  url: '/work/1.ics',
  ics: '',
  title: 'Dentist',
  description: '',
  startDate: '2026-11-12',
  startTime: '',
  endDate: '',
  endTime: '',
}

/** A server is connected, and it has one calendar and no events. The test file mocks `@/api/sources`. */
export function setUpLeaveGuard() {
  saveConnectionOf(primaryConnectionId, {
    url: 'https://caldav.example/dav/',
    username: 'user',
    password: 'secret',
  })
  serveEvents([], [work])
  vi.mocked(checkCaldav).mockResolvedValue()
}

export const back = () => screen.getByRole('button', { name: 'Back' })

export const question = () => screen.queryByText('Discard your changes?')

export async function expectAskedThenKept(onClose: ReturnType<typeof vi.fn>) {
  await userEvent.click(back())
  expect(await screen.findByText('Discard your changes?')).toBeInTheDocument()
  expect(screen.getByText('What you changed has not been saved.')).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('button', { name: 'Keep editing' }))
  await waitFor(() => {
    expect(question()).not.toBeInTheDocument()
  })
  expect(onClose).not.toHaveBeenCalled()
}

export async function expectDiscarded(onClose: ReturnType<typeof vi.fn>) {
  await userEvent.click(back())
  const dialog = await screen.findByRole('alertdialog')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Discard' }))
  await waitFor(() => {
    expect(onClose).toHaveBeenCalledOnce()
  })
}
