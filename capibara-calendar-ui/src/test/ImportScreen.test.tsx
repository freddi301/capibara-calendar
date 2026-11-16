import type { CalendarEvent } from './legacy'
import { getApi } from '../api'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { activateLocale } from '../i18n'
import { addNode, emptyFilter, newRule } from '../lib/event-filter'
import { saveEventFilter } from '../lib/event-filter-store'
import ImportScreen from '../screens/ImportScreen'
import { refOfKey } from '../lib/calendars'
import { renderApp } from './render'
import { keyOf, serveEvents } from './server'

const refOf = () => refOfKey(keyOf('/personal/'))

const picked = vi.hoisted(() => ({ file: undefined as { name: string; text: string } | undefined }))
vi.mock('../lib/file-transfer', () => ({
  pickCalendarFile: () => Promise.resolve(picked.file),
  saveCalendarFile: () => Promise.resolve(),
}))

const calendar = (...events: string[][]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//x//EN', ...events.flat(), 'END:VCALENDAR', ''].join(
    '\r\n',
  )
const event = (uid: string, title: string, ...more: string[]) => [
  'BEGIN:VEVENT',
  `UID:${uid}`,
  'DTSTAMP:20260101T000000Z',
  `SUMMARY:${title}`,
  'DTSTART:20261112T093000Z',
  ...more,
  'END:VEVENT',
]

const legacy: CalendarEvent = {
  calendarUrl: '/personal/',
  uid: 'Dentist',
  url: '/personal/Dentist.ics',
  ics: '',
  title: 'Dentist',
  description: '',
  startDate: '2026-11-12',
  startTime: '09:30',
  endDate: '',
  endTime: '',
}

beforeEach(() => {
  serveEvents([legacy], [{ url: '/personal/', name: 'Personal', color: '#2563eb' }])
  picked.file = {
    name: 'holidays.ics',
    text: calendar(event('Dentist', 'Dentist moved', 'SEQUENCE:3'), event('Lunch', 'Lunch')),
  }
})

const renderScreen = () => {
  const onClose = vi.fn()
  renderApp(<ImportScreen onClose={onClose} onOpenFilters={vi.fn()} />)
  return onClose
}
const recap = () =>
  screen.getByRole('region', { name: /What will be imported|Cosa verrà importato/ })
const rowOf = (name: string) => within(recap()).getByRole('row', { name: new RegExp(name) })
const chooseFile = (name = 'Choose a file') => userEvent.click(screen.getByRole('button', { name }))
const next = async (name: RegExp = /^Next$/) => {
  const button = screen.getByRole('button', { name })
  await waitFor(() => {
    expect(button).toBeEnabled()
  })
  await userEvent.click(button)
}
/** Chooses the file and goes on to the second step, where what will be imported is seen. */
const toRecap = async () => {
  await chooseFile()
  await next()
}

it('has the calendar, the filter and the file in the first step, and goes on only with a file', async () => {
  renderScreen()

  expect(await screen.findByRole('combobox', { name: 'Calendar' })).toBeVisible()
  expect(screen.getByRole('region', { name: 'Filter' })).toBeVisible()
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled() // no file yet
  expect(screen.queryByRole('button', { name: 'Import' })).not.toBeInTheDocument()

  await chooseFile()

  expect(await screen.findByText('File: holidays.ics')).toBeVisible()
  expect(screen.getByRole('button', { name: 'Choose another file' })).toBeVisible()
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Next' })).toBeEnabled()
  })
})

it('shows what is in the file and what importing will do, events and changed days in their own columns', async () => {
  renderScreen()
  await toRecap()

  await waitFor(() => {
    expect(rowOf('In the file')).toHaveTextContent('2')
  })
  expect(recap()).toHaveTextContent('File: holidays.ics')
  expect(recap()).toHaveTextContent('Calendar: Personal')
  expect(recap()).toHaveTextContent('No filter: all events')
  expect(rowOf('New')).toHaveTextContent('1')
  expect(rowOf('Replaced')).toHaveTextContent('1')
  expect(rowOf('Already up to date')).toHaveTextContent('0')
  expect(within(recap()).getByRole('columnheader', { name: 'Events' })).toBeVisible()
  expect(
    within(recap()).getByRole('columnheader', { name: 'Customized occurrences' }),
  ).toBeVisible()
  expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()
  // Nothing is written until it is confirmed.
  expect((await getApi().exportEvents(refOf())).join('\n')).not.toContain('Lunch')
})

it('goes back to the choices from the recap, and writes nothing', async () => {
  renderScreen()
  await toRecap()
  await waitFor(() => {
    expect(rowOf('New')).toHaveTextContent('1')
  })

  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  expect(await screen.findByRole('combobox', { name: 'Calendar' })).toBeVisible()
  expect((await getApi().exportEvents(refOf())).join('\n')).not.toContain('Lunch')
})

it('asks before it replaces, and then says what was added and what was replaced', async () => {
  renderScreen()
  await toRecap()
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Import' })).toBeEnabled()
  })

  await userEvent.click(screen.getByRole('button', { name: 'Import' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(dialog).toHaveTextContent('Replace 1 event?')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))
  expect((await getApi().exportEvents(refOf())).join('\n')).not.toContain('Lunch')

  await userEvent.click(screen.getByRole('button', { name: 'Import' }))
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Replace' }),
  )

  const done = await screen.findByRole('region', { name: 'What was imported' })
  expect(done).toHaveTextContent('1 event added')
  expect(done).toHaveTextContent('1 event replaced')
  const text = (await getApi().exportEvents(refOf())).join('\n')
  expect(text).toContain('SUMMARY:Lunch')
  expect(text).toContain('SUMMARY:Dentist moved')
})

it('does not import what the filter does not let through, and says how many', async () => {
  const root = emptyFilter()
  saveEventFilter(
    addNode(root, root.id, { ...newRule('title'), operator: 'contains', text: 'lunch' }),
  )
  renderScreen()

  await toRecap()

  await waitFor(() => {
    expect(rowOf('Ignored by the filter')).toHaveTextContent('1')
  })
  expect(recap()).toHaveTextContent('Filter on: 1 rule')
  expect(rowOf('New')).toHaveTextContent('1')
  expect(rowOf('Replaced')).toHaveTextContent('0') // the Dentist is ignored: it is not replaced
})

it('says that a file is not a calendar, and does not go on with it', async () => {
  picked.file = { name: 'photo.ics', text: 'not a calendar' }
  renderScreen()

  await chooseFile()

  expect(await screen.findByRole('alert')).toHaveTextContent('This is not a calendar file.')
  expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled()
})

it('says it in Italian', async () => {
  await activateLocale('it')
  renderScreen()

  await chooseFile('Scegli un file')
  await next(/^Avanti$/)

  await waitFor(() => {
    expect(within(recap()).getByRole('row', { name: /Nel file/ })).toHaveTextContent('2')
  })
  expect(within(recap()).getByRole('row', { name: /Sostituiti/ })).toBeVisible()
  expect(recap()).toHaveTextContent('Calendario: Personal')
})
