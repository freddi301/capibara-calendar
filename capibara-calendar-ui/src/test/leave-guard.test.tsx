import { saveConnection } from '../lib/connection'
import { checkCaldav } from '../api/sources'
import { calendarInfoOf, contractOf, failSaves, serveEvents } from './server'
import type { CalendarEvent, CalendarInfo } from './legacy'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { activateLocale } from '../i18n'
import CalendarEditScreen from '../screens/CalendarEditScreen'
import CreateEditEventScreen from '../screens/CreateEditEventScreen'
import SettingsScreen from '../screens/SettingsScreen'
import { renderApp } from './render'

vi.mock('../api/sources', async (original) => ({
  ...(await original<typeof import('../api/sources')>()),
  checkCaldav: vi.fn(),
}))

const work: CalendarInfo = { url: '/work/', name: 'Work', color: '#dc2626' }
const dentist: CalendarEvent = {
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

beforeEach(() => {
  saveConnection({ url: 'https://caldav.example/dav/', username: 'user', password: 'secret' })
  serveEvents([], [work])
  vi.mocked(checkCaldav).mockResolvedValue()
})

const back = () => screen.getByRole('button', { name: 'Back' })
const question = () => screen.queryByText('Discard your changes?')
async function expectAskedThenKept(onClose: ReturnType<typeof vi.fn>) {
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

async function expectDiscarded(onClose: ReturnType<typeof vi.fn>) {
  await userEvent.click(back())
  const dialog = await screen.findByRole('alertdialog')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Discard' }))
  await waitFor(() => {
    expect(onClose).toHaveBeenCalledOnce()
  })
}

function renderEvent(event?: CalendarEvent) {
  const onClose = vi.fn()
  renderApp(<CreateEditEventScreen event={event && contractOf(event)} onClose={onClose} />)
  return onClose
}

it('goes back from an event that was not changed without asking', async () => {
  const onClose = renderEvent(dentist)
  await screen.findByRole('combobox', { name: 'Calendar' })

  await userEvent.click(back())

  expect(onClose).toHaveBeenCalledOnce()
  expect(question()).not.toBeInTheDocument()
})

it('asks before it goes back from an event that was changed, and the person can keep it', async () => {
  const onClose = renderEvent(dentist)
  await userEvent.type(await screen.findByLabelText('Title'), ' with Sam')

  await expectAskedThenKept(onClose)

  expect(screen.getByLabelText('Title')).toHaveValue('Dentist with Sam') // nothing was lost
})

it('goes back from the event, when the person says that they do not need it', async () => {
  const onClose = renderEvent(dentist)
  await userEvent.type(await screen.findByLabelText('Title'), 'x')

  await expectDiscarded(onClose)
})

it('asks about a new event that has something in it, and not about an empty one', async () => {
  const empty = renderEvent()
  await screen.findByRole('combobox', { name: 'Calendar' })
  await userEvent.click(back())
  expect(empty).toHaveBeenCalledOnce() // nothing typed: nothing to lose
})

it('asks about a new event that has a title, or a description', async () => {
  const onClose = renderEvent()
  await userEvent.type(await screen.findByLabelText('Description'), 'Bring the forms')

  await expectAskedThenKept(onClose)
})

it('does not ask when what was changed is put back as it was', async () => {
  const onClose = renderEvent(dentist)
  const title = await screen.findByLabelText('Title')
  await userEvent.type(title, 'x')
  await userEvent.type(title, '{Backspace}')

  await userEvent.click(back())

  expect(onClose).toHaveBeenCalledOnce()
})

it('keeps what was changed in an event that could not be saved, and goes on asking', async () => {
  failSaves(new TypeError('Failed to fetch'), 'always')
  const onClose = renderEvent(dentist)
  await userEvent.type(await screen.findByLabelText('Title'), ' moved')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByRole('alert')

  await expectAskedThenKept(onClose)
})

it('asks before it goes back from a calendar that was changed, and not from one that was not', async () => {
  const unchanged = vi.fn()
  const view = renderApp(<CalendarEditScreen calendar={calendarInfoOf(work)} onClose={unchanged} />)
  await screen.findByText('Edit calendar')
  await userEvent.click(back())
  expect(unchanged).toHaveBeenCalledOnce()
  view.unmount()

  const onClose = vi.fn()
  renderApp(<CalendarEditScreen calendar={calendarInfoOf(work)} onClose={onClose} />)
  await userEvent.click(await screen.findByRole('button', { name: 'Teal' }))
  await expectAskedThenKept(onClose)
  await expectDiscarded(onClose)
})

it('asks before it goes back from a new calendar with a name', async () => {
  const onClose = vi.fn()
  renderApp(<CalendarEditScreen onClose={onClose} />)
  await userEvent.type(await screen.findByLabelText('Name'), 'Family')

  await expectAskedThenKept(onClose)
  expect(screen.getByLabelText('Name')).toHaveValue('Family')
})

it('does not ask when the calendar was saved, which goes back by itself', async () => {
  const onClose = vi.fn()
  renderApp(<CalendarEditScreen onClose={onClose} />)
  await userEvent.type(await screen.findByLabelText('Name'), 'Family')

  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(onClose).toHaveBeenCalledOnce()
  })
  expect(question()).not.toBeInTheDocument()
})

function renderSettings() {
  const onClose = vi.fn()
  renderApp(<SettingsScreen onClose={onClose} onConnectionChange={vi.fn()} />)
  return onClose
}

it('goes back from the settings without asking, when the server was not touched', async () => {
  const onClose = renderSettings()

  await userEvent.click(back())

  expect(onClose).toHaveBeenCalledOnce()
})

it('asks before it goes back from the settings, with an address that was typed and not tried', async () => {
  const onClose = renderSettings()
  await userEvent.type(screen.getByLabelText('Server address'), '2')

  await expectAskedThenKept(onClose)
  await expectDiscarded(onClose)
})

it('does not ask when what was typed was tried and kept', async () => {
  const onClose = renderSettings()
  await userEvent.type(screen.getByLabelText('Server address'), '2')
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  await screen.findByText('Connected to the CalDAV server')

  await userEvent.click(back())

  expect(onClose).toHaveBeenCalledOnce()
  expect(question()).not.toBeInTheDocument()
})

it('asks in the language of the app', async () => {
  await activateLocale('it')
  const onClose = renderEvent(dentist)
  await userEvent.type(await screen.findByLabelText('Titolo'), 'x')

  await userEvent.click(screen.getByRole('button', { name: 'Indietro' }))

  expect(await screen.findByText('Scartare le modifiche?')).toBeInTheDocument()
  expect(screen.getByText('Le modifiche non sono state salvate.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continua a modificare' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Scarta' })).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

it('does not use the question of the browser: the page can be closed or reloaded as it is', async () => {
  renderEvent(dentist)
  await userEvent.type(await screen.findByLabelText('Title'), 'x')

  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)

  expect(event.defaultPrevented).toBe(false)
})
