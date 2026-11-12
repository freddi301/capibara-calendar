import { contractOf, serveEvents } from './server'
import type { CalendarEvent } from './legacy'
import { cleanup, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import EventDetailScreen from '../screens/EventDetailScreen'
import { renderApp } from './render'

const dentist: CalendarEvent = {
  uid: '1',
  calendarUrl: '/personal/',
  url: '/personal/1.ics',
  ics: '',
  title: 'Dentist',
  description: '',
  startDate: '2026-11-12',
  startTime: '09:30',
  endDate: '',
  endTime: '11:00',
}

beforeEach(() => {
  serveEvents([], [{ url: '/personal/', name: 'Personal', color: '#2563eb' }])
})

const renderDetail = (event: CalendarEvent, onEdit = vi.fn(), onClose = vi.fn()) => {
  renderApp(<EventDetailScreen event={contractOf(event)} onEdit={onEdit} onClose={onClose} />)
  return { onEdit, onClose }
}

it('shows what the event has, in text, and nothing for what it has not', async () => {
  renderDetail({ ...dentist, location: 'Via Roma 1', tags: 'Health, Teeth', reminder: '60' })

  expect(await screen.findByRole('heading', { name: 'Dentist' })).toBeInTheDocument()
  expect(await screen.findByText('Personal')).toBeInTheDocument()
  expect(document.body).toHaveTextContent(/09:30\s*–\s*11:00/) // the times, large, in the day
  expect(screen.getByText('1 h 30 min')).toBeInTheDocument()
  expect(screen.getByText('Via Roma 1')).toBeInTheDocument()
  expect(screen.getByRole('group', { name: 'Tags' })).toHaveTextContent('HealthTeeth')
  expect(screen.getByText('1 hour before')).toBeInTheDocument()

  // No fields at all, and no row for what is empty: no video link, no description, no repeat.
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
  expect(screen.queryByText(/^Every/)).not.toBeInTheDocument()
})

it('has the pencil to change the event and the arrow to go back, and no delete', async () => {
  const { onEdit, onClose } = renderDetail(dentist)

  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  expect(onEdit).toHaveBeenCalledOnce()
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))
  expect(onClose).toHaveBeenCalledOnce()
})

it('says how the event repeats, and links only to addresses of the web', async () => {
  const weekly = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:1',
    'SUMMARY:Standup',
    'DTSTART;VALUE=DATE:20261102',
    'RRULE:FREQ=WEEKLY;INTERVAL=2;COUNT=10',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
  renderDetail({ ...dentist, isRecurring: true, ics: weekly })

  expect(await screen.findByText(/Every 2 weeks/)).toBeInTheDocument()
  expect(screen.getByText(/10 times/)).toBeInTheDocument()
  cleanup()

  renderDetail({ ...dentist, videoLink: 'https://meet.example.org/x' })
  expect(await screen.findByRole('link', { name: 'https://meet.example.org/x' })).toHaveAttribute(
    'href',
    'https://meet.example.org/x',
  )
  cleanup()

  renderDetail({ ...dentist, videoLink: 'javascript:alert(1)' })
  expect(await screen.findByText('javascript:alert(1)')).toBeInTheDocument()
  expect(screen.queryByRole('link')).not.toBeInTheDocument()
})
