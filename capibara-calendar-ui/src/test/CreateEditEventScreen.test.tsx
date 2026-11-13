import {
  contractOf,
  deleteCount,
  expectDeleted,
  expectSaved,
  failDeletes,
  failSaves,
  hangSaves,
  saveCount,
  serveEvents,
} from './server'
import type { CalendarEvent } from './legacy'
import { getApi } from '../api'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { HttpError } from '../lib/errors'
import CreateEditEventScreen from '../screens/CreateEditEventScreen'
import { renderApp } from './render'

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
  uid: '2',
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
  serveEvents([dentist, weekly], [{ url: '/personal/', name: 'Personal', color: '#2563eb' }])
})

function renderScreen(event?: CalendarEvent) {
  const onClose = vi.fn()
  renderApp(<CreateEditEventScreen event={event && contractOf(event)} onClose={onClose} />)
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
  expect(deleteCount()).toBe(0)
  await confirmDelete()

  await waitFor(() => {
    expect(onClose).toHaveBeenCalledOnce()
  })
  expect(deleteCount()).toBe(1)
  expectDeleted(dentist, undefined)
})

it('does not delete the event when it is not confirmed', async () => {
  const onClose = renderScreen(dentist)

  await click('Delete')
  await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

  await waitFor(() => {
    expect(screen.queryByText('Delete this event?')).not.toBeInTheDocument()
  })
  expect(deleteCount()).toBe(0)
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
  expectSaved(expect.objectContaining({ title: 'Standup' }), weekly, undefined)
  // Nothing was touched, so nothing is told: not the start of the series either.
  expect(vi.mocked(getApi().updateEvent).mock.calls[0][1]).toEqual({})
})

it('does not say that an event that does not repeat does', async () => {
  renderScreen(dentist)
  await screen.findByRole('combobox', { name: 'Calendar' })

  expect(screen.queryByText(/This event repeats/)).not.toBeInTheDocument()
})

it('keeps what was typed, says what went wrong, and saves when it is tried again', async () => {
  failSaves(new TypeError('Failed to fetch'))
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
  expect(saveCount()).toBe(2)
  expectSaved(expect.objectContaining({ title: 'Dentist, moved' }), dentist, undefined, 'last')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument()
})

const newer: CalendarEvent = { ...dentist, title: 'Dentist, changed elsewhere' }

it('asks what to do when the event was changed elsewhere: save over it, or see the new version', async () => {
  failSaves(new HttpError(412))
  renderScreen(dentist)

  await click('Save')

  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveTextContent('This event was changed somewhere else')
  expect(screen.queryByRole('alert')).not.toBeInTheDocument() // the question is the dialog
  for (const name of ['Cancel', 'Show the new version', 'Save anyway']) {
    expect(within(dialog).getByRole('button', { name })).toBeInTheDocument()
  }
})

it('saves over the change that was made elsewhere, from the event as it is on the server now', async () => {
  failSaves(new HttpError(412))
  vi.mocked(getApi().getEvent).mockResolvedValue(contractOf(newer))
  const onClose = renderScreen(dentist)
  await click('Save')

  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Save anyway' }),
  )

  await waitFor(() => {
    expect(onClose).toHaveBeenCalledOnce()
  })
  expect(getApi().getEvent).toHaveBeenCalledWith(contractOf(dentist).ref)
  // What was changed elsewhere stays: only what the person changed is written over it.
  expectSaved(
    expect.objectContaining({ title: 'Dentist, changed elsewhere' }),
    newer,
    undefined,
    'last',
  )
})

it('leaves the changes and goes back to the list, to see the new version', async () => {
  failSaves(new HttpError(412))
  const onClose = renderScreen(dentist)
  await click('Save')

  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', {
      name: 'Show the new version',
    }),
  )

  expect(onClose).toHaveBeenCalledOnce()
  expect(saveCount()).toBe(1) // nothing was written
})

it('keeps the form as it was, when the question is cancelled', async () => {
  failSaves(new HttpError(412))
  const onClose = renderScreen(dentist)
  await userEvent.clear(screen.getByLabelText('Title'))
  await userEvent.type(screen.getByLabelText('Title'), 'Mine')
  await click('Save')

  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
  )

  await waitFor(() => {
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })
  expect(screen.getByLabelText('Title')).toHaveValue('Mine')
  expect(onClose).not.toHaveBeenCalled()
})

it('asks about a delete in the same way, and deletes anyway when it is said', async () => {
  failDeletes(new HttpError(412))
  vi.mocked(getApi().getEvent).mockResolvedValue(contractOf(newer))
  const onClose = renderScreen(dentist)
  await click('Delete')
  await confirmDelete()

  const dialog = await screen.findByText(
    'It was changed after you opened it. You can delete it anyway.',
  )
  expect(dialog).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Delete anyway' }))

  await waitFor(() => {
    expect(onClose).toHaveBeenCalledOnce()
  })
  expectDeleted(newer, undefined)
})

it('says what the problem is for the other answers of the server', async () => {
  failSaves(new HttpError(404), 'always')
  const missing = renderScreen(dentist)
  await click('Save')
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This event is not on the server any more.',
  )
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
  missing.mockClear()
})

it('can try again after the server was busy', async () => {
  failSaves(new HttpError(503), 'always')
  renderScreen(dentist)

  await click('Save')

  expect(await screen.findByRole('alert')).toHaveTextContent('The event could not be saved.')
  expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument()
})

it('does not let the event be saved, or deleted, again while it is being saved', async () => {
  hangSaves()
  renderScreen(dentist)

  await click('Save')

  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })
  expect(screen.getByRole('button', { name: 'Delete' })).toBeDisabled()
})

it('says what went wrong when the event cannot be deleted, and deletes it when it is tried again', async () => {
  failDeletes(new TypeError('Failed to fetch'))
  const onClose = renderScreen(dentist)

  await click('Delete')
  await confirmDelete()

  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the CalDAV server')
  expect(onClose).not.toHaveBeenCalled()

  await click('Try again')

  await waitFor(() => {
    expect(deleteCount()).toBe(2)
  })
})

it('says when the calendars cannot be loaded, and loads them when it is tried again', async () => {
  vi.mocked(getApi().listCalendars).mockRejectedValueOnce(new TypeError('Failed to fetch'))
  renderScreen()

  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the CalDAV server')

  await click('Try again')

  await waitFor(() => {
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
  expect(getApi().listCalendars).toHaveBeenCalledTimes(2)
})

it('has the color of the calendar as the left border of the select and of its options', async () => {
  serveEvents(
    [dentist, weekly],
    [
      { url: '/personal/', name: 'Personal', color: '#2563eb' },
      { url: '/work/', name: 'Work', color: '#dc2626' },
    ],
  )
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

it('has the rows of what an event has besides its days, with nothing in them until it is said', async () => {
  renderScreen()

  expect(await screen.findByLabelText('Location')).toHaveValue('')
  expect(screen.getByLabelText('Video call link')).toHaveValue('')
  expect(screen.getByLabelText('New tag')).toHaveValue('')
  expect(screen.getByRole('button', { name: 'Add alert' })).toBeInTheDocument()
})

it('saves what is said of the location, the link, the tags and the reminder', async () => {
  renderScreen()
  await userEvent.type(await screen.findByLabelText('Title'), 'Review')
  await userEvent.type(screen.getByLabelText('Location'), 'Room 4')
  await userEvent.type(screen.getByLabelText('Video call link'), 'https://meet.example.org/review')
  await userEvent.type(screen.getByLabelText('New tag'), 'Work{Enter}team,')
  await userEvent.click(screen.getByRole('button', { name: 'Add alert' }))
  await userEvent.click(await screen.findByRole('combobox', { name: 'Alert 1' }))
  await userEvent.click(await screen.findByRole('option', { name: '15 minutes before' }))

  await click('Save')

  await waitFor(() => {
    expect(saveCount()).toBe(1)
  })
  expectSaved(
    expect.objectContaining({
      location: 'Room 4',
      videoLink: 'https://meet.example.org/review',
      tags: 'Work, team',
      alerts: ['15'],
    }),
    undefined,
    undefined,
  )
})

it('says that a link must be a web address, and does not save it', async () => {
  renderScreen()
  await userEvent.type(await screen.findByLabelText('Title'), 'Review')
  await userEvent.type(screen.getByLabelText('Video call link'), 'meet me there')

  await click('Save')

  expect(await screen.findByText('Enter a link that starts with https://')).toBeInTheDocument()
  expect(saveCount()).toBe(0)
})

it('shows the details of an event that was saved with them', async () => {
  renderScreen({
    ...dentist,
    location: 'Via Roma 1',
    reminder: '60',
    tags: 'Health',
    videoLink: 'https://meet.example.org/x',
  })

  expect(await screen.findByLabelText('Location')).toHaveValue('Via Roma 1')
  expect(screen.getByRole('group', { name: 'Tags' })).toHaveTextContent('Health')
  expect(screen.getByRole('combobox', { name: 'Alert 1' })).toHaveTextContent('1 hour before')
})

it('goes back to the screen of the event with Discard, and asks first when there are changes', async () => {
  const onDiscard = vi.fn()
  renderApp(
    <CreateEditEventScreen event={contractOf(dentist)} onDiscard={onDiscard} onClose={vi.fn()} />,
  )

  // Nothing was changed: it goes at once, and there is no Back.
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  await userEvent.click(await screen.findByRole('button', { name: 'Discard changes' }))
  expect(onDiscard).toHaveBeenCalledOnce()

  onDiscard.mockClear()
  await userEvent.type(screen.getByLabelText('Title'), ' and more')
  await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
  expect(onDiscard).not.toHaveBeenCalled()
  const dialog = await screen.findByRole('alertdialog')
  await userEvent.click(within(dialog).getByRole('button', { name: /Discard/ }))
  expect(onDiscard).toHaveBeenCalledOnce()
})
