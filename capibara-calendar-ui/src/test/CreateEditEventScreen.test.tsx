import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { deleteEvent, listCalendars, saveEvent, type CalendarEvent } from '../lib/caldav'
import { HttpError } from '../lib/errors'
import CreateEditEventScreen from '../screens/CreateEditEventScreen'
import { renderApp } from './render'

vi.mock('../lib/caldav')

const dentist: CalendarEvent = {
  uid: '1',
  calendarUrl: '/personal/',
  url: '/personal/1.ics',
  ics: '',
  title: 'Dentist',
  description: 'Bring the forms',
  startDate: '2026-11-12',
  startTime: '',
  endDate: '',
  endTime: '',
}

const weekly: CalendarEvent = {
  ...dentist,
  title: 'Standup',
  startDate: '2026-11-16', // the occurrence that was tapped
  isRecurring: true,
  ics: [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:1',
    'SUMMARY:Standup',
    'DTSTART;VALUE=DATE:20261102',
    'RRULE:FREQ=WEEKLY',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n'),
}

beforeEach(() => {
  vi.mocked(listCalendars).mockResolvedValue([
    { url: '/personal/', name: 'Personal', color: '#2563eb' },
  ])
  vi.mocked(saveEvent).mockResolvedValue()
  vi.mocked(deleteEvent).mockResolvedValue()
})

function renderScreen(event?: CalendarEvent) {
  const onClose = vi.fn()
  renderApp(<CreateEditEventScreen event={event} onClose={onClose} />)
  return onClose
}

const click = (name: string) => userEvent.click(screen.getByRole('button', { name }))
const confirmDelete = async () => {
  const dialog = await screen.findByRole('alertdialog')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))
}

it('has no delete button for an event that is new', async () => {
  renderScreen()
  await screen.findByRole('combobox', { name: 'Calendar' })

  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
})

it('asks before it deletes an event, and goes back when it is deleted', async () => {
  const onClose = renderScreen(dentist)

  await click('Delete')
  expect(await screen.findByText('Delete this event?')).toBeInTheDocument()
  expect(screen.getByText('This cannot be undone.')).toBeInTheDocument()
  expect(deleteEvent).not.toHaveBeenCalled()
  await confirmDelete()

  await waitFor(() => {
    expect(onClose).toHaveBeenCalledOnce()
  })
  expect(deleteEvent).toHaveBeenCalledExactlyOnceWith(dentist, undefined)
})

it('does not delete the event when it is not confirmed', async () => {
  const onClose = renderScreen(dentist)

  await click('Delete')
  await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

  await waitFor(() => {
    expect(screen.queryByText('Delete this event?')).not.toBeInTheDocument()
  })
  expect(deleteEvent).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
})

it('says that all the occurrences go, when the event repeats', async () => {
  renderScreen(weekly)

  await click('Delete')

  expect(
    await screen.findByText('It repeats: all its occurrences are deleted.'),
  ).toBeInTheDocument()
})

it('edits an event that repeats as the event, with the day it started on', async () => {
  const onClose = renderScreen(weekly)

  expect(
    screen.getByText('This event repeats. Changes are made to all its occurrences.'),
  ).toBeInTheDocument()
  await waitFor(() => {
    expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-02') // not the 16th
  })
  await click('Save')

  await waitFor(() => {
    expect(onClose).toHaveBeenCalledOnce()
  })
  expect(saveEvent).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Standup', startDate: '2026-11-02' }),
    weekly,
    undefined,
  )
})

it('does not say that an event that does not repeat does', async () => {
  renderScreen(dentist)
  await screen.findByRole('combobox', { name: 'Calendar' })

  expect(screen.queryByText(/This event repeats/)).not.toBeInTheDocument()
})

it('keeps what was typed, says what went wrong, and saves when it is tried again', async () => {
  vi.mocked(saveEvent).mockRejectedValueOnce(new TypeError('Failed to fetch'))
  const onClose = renderScreen(dentist)
  await userEvent.clear(screen.getByLabelText('Title'))
  await userEvent.type(screen.getByLabelText('Title'), 'Dentist, moved')

  await click('Save')

  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the CalDAV server')
  expect(screen.getByLabelText('Title')).toHaveValue('Dentist, moved')
  expect(onClose).not.toHaveBeenCalled()

  await click('Try again')

  await waitFor(() => {
    expect(onClose).toHaveBeenCalledOnce()
  })
  expect(saveEvent).toHaveBeenCalledTimes(2)
  expect(saveEvent).toHaveBeenLastCalledWith(
    expect.objectContaining({ title: 'Dentist, moved' }),
    dentist,
    undefined,
  )
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

it('says that the event was changed elsewhere, without offering to try again', async () => {
  vi.mocked(saveEvent).mockRejectedValue(new HttpError(412))
  renderScreen(dentist)

  await click('Save')

  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This event was changed on the server after you opened it. Go back and open it again.',
  )
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
})

it('says what the problem is for the other answers of the server', async () => {
  vi.mocked(saveEvent).mockRejectedValue(new HttpError(404))
  const missing = renderScreen(dentist)
  await click('Save')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This event is not on the server any more.',
  )
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  missing.mockClear()
})

it('can try again after the server was busy', async () => {
  vi.mocked(saveEvent).mockRejectedValue(new HttpError(503))
  renderScreen(dentist)

  await click('Save')

  expect(await screen.findByRole('alert')).toHaveTextContent('The event could not be saved.')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

it('does not let the event be saved, or deleted, again while it is being saved', async () => {
  vi.mocked(saveEvent).mockReturnValue(new Promise(() => undefined))
  renderScreen(dentist)

  await click('Save')

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
  expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
})

it('says what went wrong when the event cannot be deleted, and deletes it when it is tried again', async () => {
  vi.mocked(deleteEvent).mockRejectedValueOnce(new TypeError('Failed to fetch'))
  const onClose = renderScreen(dentist)

  await click('Delete')
  await confirmDelete()

  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the CalDAV server')
  expect(onClose).not.toHaveBeenCalled()

  await click('Try again')

  await waitFor(() => {
    expect(deleteEvent).toHaveBeenCalledTimes(2)
  })
})

it('says when the calendars cannot be loaded, and loads them when it is tried again', async () => {
  vi.mocked(listCalendars).mockRejectedValueOnce(new TypeError('Failed to fetch'))
  renderScreen()

  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the CalDAV server')

  await click('Try again')

  await waitFor(() => {
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  expect(listCalendars).toHaveBeenCalledTimes(2)
})

it('has the color of the calendar as the left border of the select and of its options', async () => {
  vi.mocked(listCalendars).mockResolvedValue([
    { url: '/personal/', name: 'Personal', color: '#2563eb' },
    { url: '/work/', name: 'Work', color: '#dc2626' },
  ])
  renderScreen(dentist)
  const select = await screen.findByRole('combobox', { name: 'Calendar' })

  await waitFor(() => {
    expect(select.style.borderLeftColor).toBe('rgb(37, 99, 235)') // the calendar of the event
  })
  expect(select).toHaveClass('border-l-4')
  await userEvent.click(select)
  const options = await screen.findAllByRole('option')
  expect(options.map((option) => option.style.borderLeftColor)).toEqual([
    'rgb(37, 99, 235)',
    'rgb(220, 38, 38)',
  ])
  expect(options.map((option) => option.textContent)).toEqual(['Personal', 'Work'])
})
