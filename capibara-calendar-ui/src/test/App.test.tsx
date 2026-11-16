import type { CalendarEvent } from './legacy'
import { getApi, resetApi, setApi } from '../api'
import { checkCaldav } from '../api/sources'
import { act, fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { activateLocale } from '../i18n'
import { clearConnection, saveConnection } from '../lib/connection'
import { matchMediaMock } from './mocks/match-media'
import { renderApp } from './render'
import { expectSaved, keyOf, saveCount, serveEvents } from './server'

vi.mock('../api/sources', async (original) => ({
  ...(await original<typeof import('../api/sources')>()),
  checkCaldav: vi.fn(),
}))
vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  resetApi: vi.fn(),
}))

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

const calendars = [
  { url: '/personal/', name: 'Personal', color: '#2563eb' },
  { url: '/work/', name: 'Work', color: '#dc2626' },
]

beforeEach(() => {
  saveConnection({ url: 'https://caldav.example/dav/', username: 'user', password: 'secret' })
  vi.setSystemTime(new Date('2026-11-12T10:00:00')) // a Thursday; the home screen shows today
  serveEvents([dentist], calendars)
  vi.mocked(checkCaldav).mockResolvedValue()
  vi.mocked(resetApi).mockImplementation(() => {
    setApi(undefined) // the next request is to the servers that are saved
  })
})

afterEach(() => {
  vi.useRealTimers()
})

async function openCreateScreen() {
  await userEvent.click(await screen.findByRole('button', { name: 'New event' }))
}

it('shows the events of today, and the connection status', async () => {
  renderApp(<App />)
  expect(await screen.findByRole('button', { name: /Dentist/ })).toBeInTheDocument()
  expect(screen.getByText('Connected to the CalDAV server')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: /Thursday, November 12, 2026: 1 event/, pressed: true }),
  ).toBeInTheDocument()
})

it('opens the create screen from the bottom bar and goes back', async () => {
  renderApp(<App />)
  await openCreateScreen()
  expect(screen.getByRole('heading', { name: 'New event' })).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  expect(await screen.findByText('Dentist')).toBeInTheDocument()
  expect(saveCount()).toBe(0)
})

it('opens the list of the calendars, not the form, when no calendar can be written', async () => {
  const api = getApi()
  const listed = await api.listCalendars()
  const readOnly = { create: false, update: false, remove: false }
  vi.mocked(api.listCalendars).mockResolvedValue(
    listed.map((one) =>
      'calendars' in one
        ? {
            ...one,
            calendars: one.calendars.map((calendar) => ({ ...calendar, rights: readOnly })),
          }
        : one,
    ),
  )
  renderApp(<App />)
  expect(await screen.findByRole('button', { name: /Dentist/ })).toBeInTheDocument()

  await openCreateScreen()

  expect(await screen.findByRole('heading', { name: 'Calendars' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'New event' })).not.toBeInTheDocument()
})

it('creates an event and returns to the list', async () => {
  renderApp(<App />)
  await openCreateScreen()
  await userEvent.type(screen.getByLabelText('Title'), 'Lunch')
  await userEvent.type(screen.getByLabelText('Description'), 'With Sam')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expectSaved(
    expect.objectContaining({
      title: 'Lunch',
      description: 'With Sam',
      startDate: Temporal.Now.plainDateISO().toString(),
      startTime: '',
    }),
    undefined,
    undefined,
  )
  expect(await screen.findByText('Dentist')).toBeInTheDocument()
})

it('edits an event with its values filled in', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Dentist/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Edit' })) // it is only looked at, at first

  expect(screen.getByRole('heading', { name: 'Edit event' })).toBeInTheDocument()
  expect(screen.getByLabelText('Title')).toHaveValue('Dentist')
  expect(screen.getByLabelText('Description')).toHaveValue('Bring the forms')
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-12')
  expect(await screen.findByRole('combobox', { name: 'Calendar' })).toHaveTextContent('Personal')

  await userEvent.type(screen.getByLabelText('Title'), ' checkup')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expectSaved(
    expect.objectContaining({ title: 'Dentist checkup' }),
    dentist,
    undefined, // the event does not repeat: no choice of which
  )
})

it('opens an event only to look at it, and changes it when the pencil is tapped', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Dentist/ }))

  expect(screen.getByRole('heading', { name: 'Event' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Dentist' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument() // text, not a form
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Edit' }))

  expect(screen.getByRole('heading', { name: 'Edit event' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  expect(screen.getByLabelText('Title')).toHaveValue('Dentist')
  expect(screen.queryByText('Edit a repeating event')).not.toBeInTheDocument() // it does not repeat

  // Discard goes back to the event, as it was.
  await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }))
  expect(screen.getByRole('heading', { name: 'Event' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Dentist' })).toBeInTheDocument()
})

it('writes a new event to the first calendar by default', async () => {
  renderApp(<App />)
  await openCreateScreen()
  await userEvent.type(screen.getByLabelText('Title'), 'Lunch')
  await waitFor(() => {
    expect(screen.getByRole('combobox', { name: 'Calendar' })).toHaveTextContent('Personal')
  })
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expectSaved(expect.objectContaining({ calendarUrl: keyOf('/personal/') }), undefined, undefined)
})

it('writes the event to the calendar that was chosen', async () => {
  renderApp(<App />)
  await openCreateScreen()
  await userEvent.type(screen.getByLabelText('Title'), 'Lunch')
  await userEvent.click(screen.getByRole('combobox', { name: 'Calendar' }))
  await userEvent.click(await screen.findByRole('option', { name: 'Work' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expectSaved(expect.objectContaining({ calendarUrl: keyOf('/work/') }), undefined, undefined)
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
  expect(saveCount()).toBe(0)
})

it('asks for a title before saving', async () => {
  renderApp(<App />)
  await openCreateScreen()
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Enter a title')).toBeInTheDocument()
  expect(saveCount()).toBe(0)
})

async function openSettings() {
  await userEvent.click(await screen.findByRole('button', { name: 'Settings' }))
}

async function choose(select: string, option: string | RegExp) {
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
  await choose('Lingua', /^Sistema/)
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
  expect(await screen.findByText(/^2 days/)).toBeInTheDocument()
  expect(screen.getByText(/1 h 30 min$/)).toBeInTheDocument()

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

it('does not ask for the picker again when the field is touched: the browser opens it', async () => {
  const showPicker = vi.fn()
  Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
    configurable: true,
    value: showPicker,
  })
  try {
    renderApp(<App />)
    await openCreateScreen()
    const field = screen.getByLabelText('Start date')

    fireEvent(field, new PointerEvent('click', { bubbles: true, pointerType: 'touch' }))
    fireEvent(field, new PointerEvent('click', { bubbles: true, pointerType: 'pen' }))
    expect(showPicker).not.toHaveBeenCalled()

    fireEvent(field, new PointerEvent('click', { bubbles: true, pointerType: 'mouse' }))
    expect(showPicker).toHaveBeenCalledOnce()
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
  expect(saveCount()).toBe(0) // and it did not save either
})

it('starts a new event on the day that is selected, and an edited event on its own day', async () => {
  renderApp(<App />)
  await screen.findByRole('button', { name: /Dentist/ })

  await userEvent.click(screen.getByRole('button', { name: /Saturday, November 14/ }))
  await userEvent.click(screen.getByRole('button', { name: 'New event' }))
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-14')
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  await userEvent.click(screen.getByRole('button', { name: /Thursday, November 12/ }))
  await userEvent.click(await screen.findByRole('button', { name: /Dentist/ }))
  await screen.findByRole('heading', { name: 'Dentist' })
  expect(document.body).toHaveTextContent('November 12') // the day of the event
})

it('follows the system time zone and first day of the week by default', async () => {
  renderApp(<App />)
  await openSettings()

  expect(screen.getByRole('combobox', { name: 'Time zone' })).toHaveTextContent(/^System /)
  expect(screen.getByRole('combobox', { name: 'First day of the week' })).toHaveTextContent(
    'System',
  )
})

it('chooses the time zone and the first day of the week, and remembers them', async () => {
  renderApp(<App />)
  await openSettings()

  await choose('Time zone', 'Kiritimati')
  await choose('First day of the week', 'Saturday')

  expect(screen.getByRole('combobox', { name: 'Time zone' })).toHaveTextContent(
    'Pacific/Kiritimati',
  )
  expect(screen.getByRole('combobox', { name: 'First day of the week' })).toHaveTextContent(
    'Saturday',
  )
  expect(JSON.parse(localStorage.getItem('capibara-calendar-settings') ?? 'null')).toEqual({
    timeZone: 'Pacific/Kiritimati',
    weekStart: 'saturday',
  })

  // Back to the system: nothing is stored any more.
  await choose('Time zone', /^System/)
  await choose('First day of the week', /^System/)
  expect(localStorage.getItem('capibara-calendar-settings')).toBeNull()
})

it('shows the week on the chosen first day, and today in the chosen time zone', async () => {
  vi.setSystemTime(new Date('2026-11-12T12:00:00Z')) // already the 13th on Kiritimati
  renderApp(<App />)
  await openSettings()
  await choose('Time zone', 'Kiritimati')
  await choose('First day of the week', 'Saturday')

  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  const week = await screen.findByRole('group', { name: 'Week' })
  expect(within(week).getAllByRole('button')[0]).toHaveAccessibleName(/^Saturday, November 7/)
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-13')
})

it('reads the events again after the time zone was changed', async () => {
  renderApp(<App />)
  await screen.findByRole('button', { name: /Dentist/ })
  await waitFor(() => {
    expect(getApi().listEvents).toHaveBeenCalledTimes(6) // the month of the week, and the one before and the one after it, of the two calendars
  })

  await openSettings()
  await choose('Time zone', 'Tokyo')
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  await screen.findByRole('button', { name: /Dentist/ })
  await waitFor(() => {
    expect(getApi().listEvents).toHaveBeenCalledTimes(12) // the times are worked out in the zone, when read
  })
})

it('shows what the system is after each System option', async () => {
  renderApp(<App />)
  await openSettings()

  expect(screen.getByRole('combobox', { name: 'Language' })).toHaveTextContent('System English')
  expect(screen.getByRole('combobox', { name: 'Theme' })).toHaveTextContent('System Light')
  expect(screen.getByRole('combobox', { name: 'Time zone' })).toHaveTextContent(
    `System ${Temporal.Now.timeZoneId()}`,
  )
  expect(screen.getByRole('combobox', { name: 'First day of the week' })).toHaveTextContent(
    'System Sunday', // the region of the browser is en-US
  )
})

it('shows a dark system theme, and the system language of the browser, in Italian', async () => {
  const lightSystem = matchMediaMock.getMockImplementation()
  matchMediaMock.mockReturnValue({
    matches: true, // the operating system is dark
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as ReturnType<typeof matchMediaMock>)
  const languages = vi.spyOn(window.navigator, 'languages', 'get').mockReturnValue(['it-IT'])
  const language = vi.spyOn(window.navigator, 'language', 'get').mockReturnValue('it-IT')
  try {
    await activateLocale('it')
    renderApp(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Impostazioni' }))

    expect(screen.getByRole('combobox', { name: 'Lingua' })).toHaveTextContent('Sistema Italiano')
    expect(screen.getByRole('combobox', { name: 'Tema' })).toHaveTextContent('Sistema Scuro')
    expect(
      screen.getByRole('combobox', { name: 'Primo giorno della settimana' }),
    ).toHaveTextContent('Sistema Lunedì')
  } finally {
    if (lightSystem) matchMediaMock.mockImplementation(lightSystem)
    languages.mockRestore() // the browser is English again for the tests after this one
    language.mockRestore()
  }
})

it('shows what the system is as secondary text next to System, not in parentheses', async () => {
  renderApp(<App />)
  await openSettings()

  const language = screen.getByRole('combobox', { name: 'Language' })
  expect(within(language).getByText('English')).toHaveClass('text-muted-foreground')
  expect(language).not.toHaveTextContent('(')
  expect(within(screen.getByRole('combobox', { name: 'Theme' })).getByText('Light')).toHaveClass(
    'text-muted-foreground',
  )
})

it('shows the dates and times of the form in the language of the app', async () => {
  const startsAt = async () => {
    await userEvent.click(await screen.findByRole('button', { name: /^(New event|Nuovo evento)$/ }))
    fireEvent.change(screen.getByLabelText(/^(Start time|Ora di inizio)$/), {
      target: { value: '09:30' },
    })
    fireEvent.change(screen.getByLabelText(/^(End date|Data di fine)$/), {
      target: { value: '2026-11-14' },
    })
  }
  const english = renderApp(<App />)
  await startsAt()
  // Month first in English, and the time in 24 hours.
  expect(screen.getByDisplayValue('11/12/2026')).toBeInTheDocument()
  expect(screen.getByDisplayValue('11/14/2026')).toBeInTheDocument()
  expect(screen.getAllByDisplayValue('09:30')).toHaveLength(2) // the field, and what is shown of it
  english.unmount()
  localStorage.removeItem('capibara-calendar-route') // the screen is remembered: start from the list

  await activateLocale('it')
  renderApp(<App />)
  await startsAt()
  // Day first in Italian, and 24 hours.
  expect(screen.getByDisplayValue('12/11/2026')).toBeInTheDocument()
  expect(screen.getByDisplayValue('14/11/2026')).toBeInTheDocument()
  // The native field also holds 09:30 (its value is always 24 hours); the one on show is read-only.
  const shown = screen
    .getAllByDisplayValue('09:30')
    .filter((input) => input.hasAttribute('readonly'))
  expect(shown).toHaveLength(1)
})

async function chooseLayout(name: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Layouts' }))
  expect(screen.getByRole('heading', { name: 'Layouts' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name }))
}

it('has the layouts in the order of Agenda, Week and Days, with the Days in use at first', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Layouts' }))

  const options = screen
    .getAllByRole('button')
    .map((button) => button.textContent)
    .filter((text) => ['Agenda', 'Week', 'Days'].includes(text))
  expect(options).toEqual(['Agenda', 'Week', 'Days'])
  expect(screen.getByRole('button', { name: 'Days' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.getByRole('button', { name: 'Agenda' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.queryByRole('button', { name: 'Month' })).not.toBeInTheDocument()
})

it('switches between the layouts, keeping the selected day', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Saturday, November 14/ }))

  await chooseLayout('Week')
  expect(screen.getByRole('group', { name: /Saturday, November 14, 2026/ })).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-14')

  await chooseLayout('Agenda')
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-14')

  await chooseLayout('Days')
  expect(screen.getByRole('group', { name: 'Week' })).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-14')
})

it('marks the layout in use, and goes back without changing it', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Layouts' }))

  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  expect(screen.getByRole('group', { name: 'Week' })).toBeInTheDocument()
})

it('comes back to the layout that was chosen, from the screens opened by the bottom bar', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Layouts' }))
  await userEvent.click(screen.getByRole('button', { name: 'Week' }))

  await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Back' }))

  expect(screen.getByRole('group', { name: /Thursday, November 12, 2026/ })).toBeInTheDocument()
})

it('shows the agenda from the selected day, and keeps it as the layout', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Saturday, November 14/ }))

  await chooseLayout('Agenda')

  expect(screen.queryByRole('group', { name: 'Week' })).not.toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Month' })).not.toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Layouts' }))
  expect(screen.getByRole('button', { name: 'Agenda' })).toHaveAttribute('aria-pressed', 'true')
})

it('shows the week as rows, from the selected day, and keeps it as the layout', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Saturday, November 14/ }))

  await chooseLayout('Week')

  expect(screen.getByRole('group', { name: /Saturday, November 14, 2026/ })).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-14')
  await userEvent.click(screen.getByRole('button', { name: 'Layouts' }))
  expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
})

it('shows the week or the month above the days, with the button on the line below it', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Saturday, November 14/ }))

  await userEvent.click(screen.getByRole('button', { name: 'Show the month' }))
  expect(screen.getByRole('group', { name: 'Month' })).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Week' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Saturday, November 14/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  ) // the day that was selected, in the month
  expect(screen.getByRole('button', { name: 'Show the week' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )

  await userEvent.click(screen.getByRole('button', { name: 'Show the week' }))
  expect(screen.getByRole('group', { name: 'Week' })).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-14')
})

it('remembers whether the days have the week or the month above them', async () => {
  const first = renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Show the month' }))
  await userEvent.click(screen.getByRole('button', { name: 'Layouts' }))
  await userEvent.click(screen.getByRole('button', { name: 'Agenda' }))
  await userEvent.click(screen.getByRole('button', { name: 'Layouts' }))
  await userEvent.click(screen.getByRole('button', { name: 'Days' }))
  expect(screen.getByRole('group', { name: 'Month' })).toBeInTheDocument()
  first.unmount()

  renderApp(<App />)

  expect(await screen.findByRole('group', { name: 'Month' })).toBeInTheDocument()
})

describe('the calendars screen', () => {
  it('opens from the bottom bar, and goes back to the list', async () => {
    renderApp(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Calendars' }))
    expect(await screen.findByRole('heading', { name: 'Calendars' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(await screen.findByRole('group', { name: 'Week' })).toBeInTheDocument()
  })

  it('hides the events of the calendar that is switched off, and shows them when it is back on', async () => {
    renderApp(<App />)
    expect(await screen.findByRole('button', { name: /Dentist/ })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Calendars' }))
    await userEvent.click(await screen.findByRole('switch', { name: 'Personal' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    await screen.findByRole('group', { name: 'Week' })
    expect(screen.queryByRole('button', { name: /Dentist/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Calendars' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Show all' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(await screen.findByRole('button', { name: /Dentist/ })).toBeInTheDocument()
  })
})

describe('the filter of the events', () => {
  async function openFilterAndGoBack(change: () => Promise<void>) {
    await userEvent.click(screen.getByRole('button', { name: 'Filter' }))
    await change()
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))
    await screen.findByRole('group', { name: 'Week' })
  }

  it('shows only the events that the rules choose, as they are made, and counts the rules', async () => {
    renderApp(<App />)
    expect(await screen.findByRole('button', { name: /Dentist/ })).toBeInTheDocument()

    await openFilterAndGoBack(async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Add rule' }))
      await userEvent.click(await screen.findByRole('menuitem', { name: /Title/ }))
      await userEvent.type(await screen.findByRole('textbox', { name: 'Title' }), 'zzz')
    })

    // Nothing has "zzz" in its title: the list says so, and the icon says that a rule is there.
    expect(await screen.findByText('No event matches the filter')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Dentist/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filter' })).toHaveTextContent('1')

    await openFilterAndGoBack(async () => {
      const word = await screen.findByRole('textbox', { name: 'Title' })
      await userEvent.clear(word)
      await userEvent.type(word, 'dent')
    })
    expect(await screen.findByRole('button', { name: /Dentist/ })).toBeInTheDocument()

    await openFilterAndGoBack(async () => {
      await userEvent.click(await screen.findByRole('button', { name: 'Reset' }))
    })
    expect(screen.getByRole('button', { name: 'Filter' })).not.toHaveTextContent('1')
  })

  it('goes to the filter from the export of a calendar, and comes back to the export, not to the list', async () => {
    renderApp(<App />)
    expect(await screen.findByRole('button', { name: /Dentist/ })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Calendars' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Export' }))
    const banner = await screen.findByRole('region', { name: 'Filter' })
    await userEvent.click(within(banner).getByRole('button', { name: 'Set a filter' }))

    // The filter, with the way back: the rules are made, and the export is where it was.
    await userEvent.click(await screen.findByRole('button', { name: 'Add rule' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: /Title/ }))
    await userEvent.type(await screen.findByRole('textbox', { name: 'Title' }), 'dent')
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    const again = await screen.findByRole('region', { name: 'Filter' })
    expect(again).toHaveTextContent('Filter on: 1 rule')
    expect(screen.queryByRole('group', { name: 'Week' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Calendar' })).toBeInTheDocument() // the export
  })

  it('shows how many calendars are on out of all of them', async () => {
    renderApp(<App />)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Calendars' })).toHaveTextContent('2/2')
    })
    await userEvent.click(screen.getByRole('button', { name: 'Calendars' }))
    await userEvent.click(await screen.findByRole('switch', { name: 'Work' }))
    await userEvent.click(screen.getByRole('button', { name: 'Close' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Calendars' })).toHaveTextContent('1/2')
    })
  })
})

describe('the place that is remembered', () => {
  it('is the layout that was chosen, and the day that was shown', async () => {
    const first = renderApp(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /Saturday, November 14/ }))
    await chooseLayout('Week')
    first.unmount()

    renderApp(<App />)

    expect(
      await screen.findByRole('group', { name: /Saturday, November 14, 2026/ }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-14')
  })

  it('follows the day when it changes without leaving the list', async () => {
    const first = renderApp(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /Friday, November 13/ }))
    first.unmount()

    renderApp(<App />)

    expect(await screen.findByLabelText('Choose a date')).toHaveValue('2026-11-13')
  })

  it('is the screen that was open: the settings, the filter and an event that was being edited', async () => {
    const settings = renderApp(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Settings' }))
    settings.unmount()
    const afterSettings = renderApp(<App />)
    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await userEvent.click(await screen.findByRole('button', { name: /Dentist/ }))
    afterSettings.unmount()

    renderApp(<App />)

    expect(await screen.findByRole('heading', { name: 'Event' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Dentist' })).toBeInTheDocument()
  })

  it('starts on the list when what was remembered is not usable', async () => {
    localStorage.setItem(
      'capibara-calendar-route',
      '{"route":{"screen":"layouts"},"layout":"agenda"}',
    )
    renderApp(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Layouts' }))
    expect(screen.getByRole('button', { name: 'Agenda' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('is the screen of the event after it is saved, and the list after it is deleted', async () => {
    serveEvents([dentist], calendars)
    const first = renderApp(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /Dentist/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Save' }))
    expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument() // the event, looked at
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    await screen.findByRole('group', { name: 'Week' })
    first.unmount()

    renderApp(<App />)

    expect(await screen.findByRole('group', { name: 'Week' })).toBeInTheDocument()
  })
})

describe('the connection', () => {
  it('opens the settings, to say which server, when there is none, with no way to go back', async () => {
    clearConnection()
    setApi(undefined)
    renderApp(<App />)

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByLabelText('Server address')).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New event' })).not.toBeInTheDocument()
  })

  it('opens the settings for any screen that was remembered, when there is no server', async () => {
    clearConnection()
    setApi(undefined)
    localStorage.setItem(
      'capibara-calendar-route',
      '{"route":{"screen":"filter"},"layout":"agenda"}',
    )
    renderApp(<App />)

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Calendars' })).not.toBeInTheDocument()
  })

  it('goes to the calendars when the first server is connected', async () => {
    clearConnection()
    setApi(undefined)
    renderApp(<App />)

    vi.mocked(resetApi).mockImplementation(() => {
      serveEvents([dentist], calendars) // the server that was just connected
    })
    await userEvent.type(await screen.findByLabelText('Server address'), '/radicale/')
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))

    expect(await screen.findByRole('group', { name: 'Week' })).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: /Dentist/ })).toBeInTheDocument()
  })

  it('stays in the settings when another server is connected, and says so', async () => {
    renderApp(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Settings' }))

    await userEvent.type(screen.getByLabelText('Username'), '2')
    await userEvent.click(screen.getByRole('button', { name: 'Connect' }))

    expect(await screen.findByText('Connected to the CalDAV server')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  })

  it('goes back to asking for a server when it is disconnected', async () => {
    renderApp(<App />)
    await userEvent.click(await screen.findByRole('button', { name: 'Settings' }))

    await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }))

    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Server address')).toHaveValue('')
  })

  it('opens the calendars when there is a server', async () => {
    renderApp(<App />)

    expect(await screen.findByRole('group', { name: 'Week' })).toBeInTheDocument()
  })
})

it('says that there is no network, and shows what was loaded last', async () => {
  renderApp(<App />)
  expect(await screen.findByText('Connected to the CalDAV server')).toBeInTheDocument()

  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  act(() => {
    window.dispatchEvent(new Event('offline'))
  })

  expect(await screen.findByText('No network. You see what was loaded last.')).toBeInTheDocument()
  expect(screen.queryByText('Connected to the CalDAV server')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Dentist/ })).toBeInTheDocument() // what was loaded

  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  act(() => {
    window.dispatchEvent(new Event('online'))
  })
  await waitFor(() => {
    expect(screen.queryByText('No network. You see what was loaded last.')).not.toBeInTheDocument()
  })
})
