import { fireEvent, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import App from '../App'
import { activateLocale } from '../i18n'
import { listCalendars, listEvents, saveEvent, type CalendarEvent } from '../lib/caldav'
import { renderApp } from './render'

vi.mock('../lib/caldav')

const dentist: CalendarEvent = {
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

beforeEach(() => {
  vi.mocked(listCalendars).mockResolvedValue([
    { url: '/personal/', name: 'Personal' },
    { url: '/work/', name: 'Work' },
  ])
  vi.mocked(listEvents).mockResolvedValue([dentist])
  vi.mocked(saveEvent).mockResolvedValue()
})

async function openCreateScreen() {
  await userEvent.click(await screen.findByRole('button', { name: 'New event' }))
}

it('shows the connection status and the events', async () => {
  renderApp(<App />)
  expect(await screen.findByText('Dentist')).toBeInTheDocument()
  expect(screen.getByText('2026-11-12')).toBeInTheDocument()
  expect(screen.getByText('Connected to the CalDAV server')).toBeInTheDocument()
})

it('reports when the server cannot be reached', async () => {
  vi.mocked(listEvents).mockRejectedValue(new Error('offline'))
  renderApp(<App />)
  expect(await screen.findByText('Cannot reach the CalDAV server')).toBeInTheDocument()
})

it('opens the create screen from the bottom bar and goes back', async () => {
  renderApp(<App />)
  await openCreateScreen()
  expect(screen.getByRole('heading', { name: 'New event' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  expect(await screen.findByText('Dentist')).toBeInTheDocument()
  expect(saveEvent).not.toHaveBeenCalled()
})

it('creates an event and returns to the list', async () => {
  renderApp(<App />)
  await openCreateScreen()
  await userEvent.type(screen.getByLabelText('Title'), 'Lunch')
  await userEvent.type(screen.getByLabelText('Description'), 'With Sam')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(saveEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Lunch',
      description: 'With Sam',
      startDate: Temporal.Now.plainDateISO().toString(),
      startTime: '',
    }),
    undefined,
  )
  expect(await screen.findByText('Dentist')).toBeInTheDocument()
})

it('edits an event with its values filled in', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Edit Dentist' }))

  expect(screen.getByRole('heading', { name: 'Edit event' })).toBeInTheDocument()
  expect(screen.getByLabelText('Title')).toHaveValue('Dentist')
  expect(screen.getByLabelText('Description')).toHaveValue('Bring the forms')
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-12')
  expect(await screen.findByRole('combobox', { name: 'Calendar' })).toHaveTextContent('Personal')

  await userEvent.type(screen.getByLabelText('Title'), ' checkup')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(saveEvent).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Dentist checkup' }),
    dentist,
  )
})

it('writes a new event to the first calendar by default', async () => {
  renderApp(<App />)
  await openCreateScreen()
  await userEvent.type(screen.getByLabelText('Title'), 'Lunch')
  await waitFor(() => {
    expect(screen.getByRole('combobox', { name: 'Calendar' })).toHaveTextContent('Personal')
  })
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(saveEvent).toHaveBeenCalledWith(
    expect.objectContaining({ calendarUrl: '/personal/' }),
    undefined,
  )
})

it('writes the event to the calendar that was chosen', async () => {
  renderApp(<App />)
  await openCreateScreen()
  await userEvent.type(screen.getByLabelText('Title'), 'Lunch')
  await userEvent.click(screen.getByRole('combobox', { name: 'Calendar' }))
  await userEvent.click(await screen.findByRole('option', { name: 'Work' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(saveEvent).toHaveBeenCalledWith(
    expect.objectContaining({ calendarUrl: '/work/' }),
    undefined,
  )
})

it('marks the end in red when it is before the start', async () => {
  renderApp(<App />)
  await openCreateScreen()
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-11-12' } })
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-11-10' } })

  expect(await screen.findByText('The end cannot be before the start')).toBeInTheDocument()
  expect(screen.getByLabelText('End date')).toBeInvalid()
  expect(screen.getByLabelText('Start date')).toBeValid()

  await userEvent.type(screen.getByLabelText('Title'), 'Trip')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(saveEvent).not.toHaveBeenCalled()
})

it('asks for a title before saving', async () => {
  renderApp(<App />)
  await openCreateScreen()
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Enter a title')).toBeInTheDocument()
  expect(saveEvent).not.toHaveBeenCalled()
})

async function openSettings() {
  await userEvent.click(await screen.findByRole('button', { name: 'Settings' }))
}

async function choose(select: string, option: string) {
  await userEvent.click(screen.getByRole('combobox', { name: select }))
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

it('opens the settings page from the bottom bar and goes back', async () => {
  renderApp(<App />)
  await openSettings()
  expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  // Language and theme both follow the system by default.
  expect(screen.getByRole('combobox', { name: 'Language' })).toHaveTextContent('System')
  expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveTextContent('System')

  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  expect(await screen.findByText('Dentist')).toBeInTheDocument()
})

it('switches the language and remembers it', async () => {
  renderApp(<App />)
  await openSettings()
  await choose('Language', 'Italiano')

  expect(await screen.findByRole('heading', { name: 'Impostazioni' })).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Lingua' })).toHaveTextContent('Italiano')
  expect(JSON.parse(localStorage.getItem('capibara-calendar-settings') ?? 'null')).toEqual({
    language: 'it',
  })

  // Back to the system language: the choice is forgotten.
  await choose('Lingua', 'Sistema')
  expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  expect(localStorage.getItem('capibara-calendar-settings')).toBeNull()
})

it('switches the theme and remembers it', async () => {
  renderApp(<App />)
  await openSettings()
  await choose('Theme', 'Dark')

  expect(document.documentElement).toHaveClass('dark')
  expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveTextContent('Dark')
  expect(JSON.parse(localStorage.getItem('capibara-calendar-settings') ?? 'null')).toEqual({
    theme: 'dark',
  })

  await choose('Theme', 'Light')
  expect(document.documentElement).not.toHaveClass('dark')
})

it('shows the choices that were saved earlier', async () => {
  localStorage.setItem('capibara-calendar-settings', JSON.stringify({ theme: 'light' }))
  renderApp(<App />)
  await openSettings()

  expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveTextContent('Light')
  expect(screen.getByRole('combobox', { name: 'Language' })).toHaveTextContent('System')
})

it('shows the derived durations of the start and the end', async () => {
  renderApp(<App />)
  await openCreateScreen()

  // Whole days: the first and the last day both count.
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-11-12' } })
  expect(await screen.findByText('1 day')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-11-14' } })
  expect(await screen.findByText('3 days')).toBeInTheDocument()

  // With times: the days that passed, and the time beyond them. They add up, nothing is counted twice.
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-11-12' } })
  fireEvent.change(screen.getByLabelText('Start time'), { target: { value: '09:30' } })
  fireEvent.change(screen.getByLabelText('End time'), { target: { value: '11:00' } })
  expect(await screen.findByText('1 h 30 min')).toBeInTheDocument()
  expect(screen.queryByText('1 day')).not.toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('End time'), { target: { value: '10:30' } })
  expect(await screen.findByText('1 h')).toBeInTheDocument()
  fireEvent.change(screen.getByLabelText('End time'), { target: { value: '09:45' } })
  expect(await screen.findByText('15 min')).toBeInTheDocument()

  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-11-14' } })
  fireEvent.change(screen.getByLabelText('End time'), { target: { value: '11:00' } })
  expect(await screen.findByText('2 days')).toBeInTheDocument()
  expect(screen.getByText('1 h 30 min')).toBeInTheDocument()

  // Exactly whole days: the days say it all, there is no time to add.
  fireEvent.change(screen.getByLabelText('End time'), { target: { value: '09:30' } })
  expect(await screen.findByText('2 days')).toBeInTheDocument()
  expect(screen.queryByText(/ min$| h$/)).not.toBeInTheDocument()
})

it('shows the durations in the language of the app', async () => {
  await activateLocale('it')
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Nuovo evento' }))
  fireEvent.change(screen.getByLabelText('Data di inizio'), { target: { value: '2026-11-12' } })
  fireEvent.change(screen.getByLabelText('Data di fine'), { target: { value: '2026-11-14' } })

  expect(await screen.findByText('3 giorni')).toBeInTheDocument()
  expect(screen.getByText('Inizio')).toBeInTheDocument()
  expect(screen.getByText('Fine')).toBeInTheDocument()
})

it('opens the native picker when a date or time field is clicked', async () => {
  // jsdom has no pickers, so showPicker is added for this test.
  const showPicker = vi.fn()
  Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
    configurable: true,
    value: showPicker,
  })
  try {
    renderApp(<App />)
    await openCreateScreen()
    for (const label of ['Start date', 'Start time', 'End date', 'End time']) {
      await userEvent.click(screen.getByLabelText(label))
    }
    expect(showPicker).toHaveBeenCalledTimes(4)
  } finally {
    Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker')
  }
})

it('starts the title with one row and keeps it on one line', async () => {
  renderApp(<App />)
  await openCreateScreen()
  const title = screen.getByLabelText('Title')
  expect(title).toHaveAttribute('rows', '1')

  await userEvent.type(title, 'Lunch{Enter}with Sam')

  expect(title).toHaveValue('Lunchwith Sam') // Enter did not add a line break
  expect(saveEvent).not.toHaveBeenCalled() // and it did not save either
})
