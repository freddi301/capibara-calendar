import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../App'
import { activateLocale } from '../i18n'
import {
  checkConnection,
  listCalendars,
  listEvents,
  saveEvent,
  type CalendarEvent,
} from '../lib/caldav'
import { clearConnection } from '../lib/connection'
import { matchMediaMock } from './mocks/match-media'
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
  vi.setSystemTime(new Date('2026-11-12T10:00:00')) // a Thursday; the home screen shows today
  vi.mocked(listCalendars).mockResolvedValue([
    { url: '/personal/', name: 'Personal', color: '#2563eb' },
    { url: '/work/', name: 'Work', color: '#dc2626' },
  ])
  vi.mocked(listEvents).mockResolvedValue([dentist])
  vi.mocked(saveEvent).mockResolvedValue()
  vi.mocked(checkConnection).mockResolvedValue()
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
  await userEvent.click(await screen.findByRole('button', { name: /Dentist/ }))

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

it('starts a new event on the day that is selected, and an edited event on its own day', async () => {
  renderApp(<App />)
  await screen.findByRole('button', { name: /Dentist/ })

  await userEvent.click(screen.getByRole('button', { name: /Saturday, November 14/ }))
  await userEvent.click(screen.getByRole('button', { name: 'New event' }))
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-14')
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  await userEvent.click(screen.getByRole('button', { name: /Thursday, November 12/ }))
  await userEvent.click(await screen.findByRole('button', { name: /Dentist/ }))
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-12')
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

  await choose('Time zone', 'Pacific/Kiritimati')
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
  await choose('Time zone', 'Pacific/Kiritimati')
  await choose('First day of the week', 'Saturday')

  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  const week = await screen.findByRole('group', { name: 'Week' })
  expect(within(week).getAllByRole('button')[0]).toHaveAccessibleName(/^Saturday, November 7/)
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-13')
})

it('reads the events again after the time zone was changed', async () => {
  renderApp(<App />)
  await screen.findByRole('button', { name: /Dentist/ })
  expect(listEvents).toHaveBeenCalledTimes(1)

  await openSettings()
  await choose('Time zone', 'Asia/Tokyo')
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  await screen.findByRole('button', { name: /Dentist/ })
  expect(listEvents).toHaveBeenCalledTimes(2) // the times are worked out in the zone, when read
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
  // Month first in English, and AM and PM.
  expect(screen.getByDisplayValue('11/12/2026')).toBeInTheDocument()
  expect(screen.getByDisplayValue('11/14/2026')).toBeInTheDocument()
  expect(screen.getByDisplayValue('9:30 AM')).toBeInTheDocument()
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

it('switches between the week and the month, keeping the selected day', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Saturday, November 14/ }))

  await chooseLayout('Month')
  expect(screen.getByRole('group', { name: 'Month' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Saturday, November 14/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  )

  await chooseLayout('Week')
  expect(screen.getByRole('group', { name: 'Week' })).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-14')
})

it('marks the layout in use, and goes back without changing it', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Layouts' }))
  expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Month' })).toHaveAttribute('aria-pressed', 'false')

  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  expect(screen.getByRole('group', { name: 'Week' })).toBeInTheDocument()
})

it('comes back to the layout that was chosen, from the screens opened by the bottom bar', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Layouts' }))
  await userEvent.click(screen.getByRole('button', { name: 'Month' }))

  await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Back' }))

  expect(screen.getByRole('group', { name: 'Month' })).toBeInTheDocument()
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

  await chooseLayout('Week rows')

  expect(screen.getByRole('group', { name: /Saturday, November 14, 2026/ })).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-14')
  await userEvent.click(screen.getByRole('button', { name: 'Layouts' }))
  expect(screen.getByRole('button', { name: 'Week rows' })).toHaveAttribute('aria-pressed', 'true')
})

describe('the filter', () => {
  it('opens from the bottom bar, and goes back to the list', async () => {
    renderApp(<App />)

    await userEvent.click(await screen.findByRole('button', { name: 'Filter' }))
    expect(await screen.findByRole('heading', { name: 'Filter' })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(await screen.findByRole('group', { name: 'Week' })).toBeInTheDocument()
  })

  it('hides the events of the calendar that is switched off, and shows them when it is back on', async () => {
    renderApp(<App />)
    expect(await screen.findByRole('button', { name: /Dentist/ })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }))
    await userEvent.click(await screen.findByRole('switch', { name: 'Personal' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    await screen.findByRole('group', { name: 'Week' })
    expect(screen.queryByRole('button', { name: /Dentist/ })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Filter' }))
    await userEvent.click(await screen.findByRole('button', { name: 'Show all' }))
    await userEvent.click(screen.getByRole('button', { name: 'Back' }))

    expect(await screen.findByRole('button', { name: /Dentist/ })).toBeInTheDocument()
  })
})

describe('the place that is remembered', () => {
  it('is the layout that was chosen, and the day that was shown', async () => {
    const first = renderApp(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /Saturday, November 14/ }))
    await chooseLayout('Month')
    first.unmount()

    renderApp(<App />)

    expect(await screen.findByRole('group', { name: 'Month' })).toBeInTheDocument()
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

    expect(await screen.findByRole('heading', { name: 'Edit event' })).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Dentist')
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

  it('is the list again after an event is saved or deleted', async () => {
    vi.mocked(listEvents).mockResolvedValue([dentist])
    const first = renderApp(<App />)
    await userEvent.click(await screen.findByRole('button', { name: /Dentist/ }))
    await userEvent.click(await screen.findByRole('button', { name: 'Save' }))
    await screen.findByRole('group', { name: 'Week' })
    first.unmount()

    renderApp(<App />)

    expect(await screen.findByRole('group', { name: 'Week' })).toBeInTheDocument()
  })
})

describe('the connection', () => {
  it('opens the settings, to say which server, when there is none, with no way to go back', async () => {
    clearConnection()
    renderApp(<App />)

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.getByLabelText('Server address')).toHaveFocus()
    expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'New event' })).not.toBeInTheDocument()
  })

  it('opens the settings for any screen that was remembered, when there is no server', async () => {
    clearConnection()
    localStorage.setItem(
      'capibara-calendar-route',
      '{"route":{"screen":"filter"},"layout":"agenda"}',
    )
    renderApp(<App />)

    expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Filter' })).not.toBeInTheDocument()
  })

  it('goes to the calendars when the first server is connected', async () => {
    clearConnection()
    renderApp(<App />)

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
