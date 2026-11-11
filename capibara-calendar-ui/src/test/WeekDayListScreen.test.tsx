import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { activateLocale } from '../i18n'
import { listEvents, type CalendarEvent } from '../lib/caldav'
import WeekDayListScreen from '../screens/WeekDayListScreen'
import { renderApp } from './render'

vi.mock('../lib/caldav')

function event(title: string, fields: Partial<CalendarEvent>): CalendarEvent {
  return {
    calendarUrl: '/c/',
    uid: title,
    url: `/c/${title}.ics`,
    ics: '',
    title,
    description: '',
    startDate: '2026-11-12',
    startTime: '',
    endDate: '',
    endTime: '',
    ...fields,
  }
}

// Today is Thursday 12 November 2026. The week runs from Monday 9 to Sunday 15.
const events = [
  event('Standup', { startTime: '09:00', endTime: '09:30' }),
  event('Conference', { endDate: '2026-11-14' }), // Thursday to Saturday, all day
  event('Hike', { startDate: '2026-11-14', startTime: '10:00', endTime: '14:00' }),
  event('Planning', { startDate: '2026-11-16' }), // next week
]

const storeSettings = (settings: object) => {
  localStorage.setItem('capibara-calendar-settings', JSON.stringify(settings))
}

beforeEach(() => {
  vi.setSystemTime(new Date('2026-11-12T10:00:00'))
  vi.mocked(listEvents).mockResolvedValue(events)
  storeSettings({ weekStart: 'monday' }) // English defaults to Sunday
})

afterEach(() => {
  vi.useRealTimers()
})

const day = (label: RegExp) => screen.getByRole('button', { name: label })

function renderScreen() {
  const handlers = { onCreate: vi.fn(), onEdit: vi.fn(), onOpenSettings: vi.fn() }
  const view = renderApp(<WeekDayListScreen {...handlers} />)
  return { ...handlers, unmount: view.unmount }
}

it('shows the selected day above its week', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-12')
  expect(screen.getByRole('combobox', { name: 'Month: November' })).toHaveTextContent('November')
  expect(screen.getByRole('combobox', { name: 'Year: 2026' })).toHaveTextContent('2026')

  const week = within(screen.getByRole('group', { name: 'Week' })).getAllByRole('button')
  expect(week).toHaveLength(7)
  expect(week[0]).toHaveAccessibleName(/^Monday, November 9, 2026/)
  expect(week[6]).toHaveAccessibleName(/^Sunday, November 15, 2026/)
  expect(day(/Thursday, November 12/)).toHaveAttribute('aria-pressed', 'true')
  expect(day(/Thursday, November 12/)).toHaveAttribute('aria-current', 'date')
})

it('counts the events of each day, multi-day events on every day they cover', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(day(/Monday, November 9, 2026$/)).toBeInTheDocument() // nothing planned: no count
  expect(day(/Thursday, November 12, 2026: 2 events/)).toBeInTheDocument()
  expect(day(/Friday, November 13, 2026: 1 event$/)).toBeInTheDocument()
  expect(day(/Saturday, November 14, 2026: 2 events/)).toBeInTheDocument()
  expect(day(/Sunday, November 15, 2026$/)).toBeInTheDocument()
})

it('lists the events of the day: no time first, then by time, with start and end', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  const buttons = screen
    .getAllByRole('button')
    .filter((button) => /Conference|Standup/.test(button.textContent))
  expect(buttons.map((button) => button.textContent)).toEqual([
    'Conference',
    '9:00 AM9:30 AMStandup',
  ])
})

it('shows another day when it is tapped, and says when nothing is planned', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  await userEvent.click(day(/Saturday, November 14/))
  expect(day(/Saturday, November 14/)).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-14')
  expect(screen.getByRole('button', { name: /Conference/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Hike/ })).toHaveTextContent('10:00 AM2:00 PMHike')
  expect(screen.queryByRole('button', { name: /Standup/ })).not.toBeInTheDocument()

  await userEvent.click(day(/Monday, November 9/))
  expect(await screen.findByText('Nothing planned')).toBeInTheDocument()
})

it('goes back to today with the Today button', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  await userEvent.click(day(/Monday, November 9/))
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-09')

  await userEvent.click(screen.getByRole('button', { name: 'Today' }))

  expect(day(/Thursday, November 12/)).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-12')
})

it('opens an event from its card, and the screens from the bottom bar', async () => {
  const { onCreate, onEdit, onOpenSettings } = renderScreen()

  await userEvent.click(await screen.findByRole('button', { name: /Standup/ }))
  await userEvent.click(screen.getByRole('button', { name: 'New event' }))
  await userEvent.click(screen.getByRole('button', { name: 'Settings' }))

  expect(onEdit).toHaveBeenCalledWith(events[0])
  expect(onCreate).toHaveBeenCalledExactlyOnceWith('2026-11-12') // the selected day, today
  expect(onOpenSettings).toHaveBeenCalledOnce()
})

it('reports when the server cannot be reached', async () => {
  vi.mocked(listEvents).mockRejectedValue(new Error('offline'))
  renderScreen()

  expect(await screen.findByText('Cannot reach the CalDAV server')).toBeInTheDocument()
})

it('is in the language of the app', async () => {
  await activateLocale('it')
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(day(/giovedì 12 novembre 2026: 2 eventi/)).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Mese: Novembre' })).toHaveTextContent('Novembre')
  expect(
    within(screen.getByRole('group', { name: 'Settimana' })).getAllByRole('button')[0],
  ).toHaveTextContent('Lun')
  expect(screen.getByRole('button', { name: 'Oggi' })).toBeInTheDocument()
  await userEvent.click(day(/lunedì 9 novembre 2026/))
  expect(await screen.findByText('Niente in programma')).toBeInTheDocument()
})

it('picks a month and a year from lists, keeping the day', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  await userEvent.click(screen.getByRole('combobox', { name: /^Month/ }))
  await userEvent.click(await screen.findByRole('option', { name: 'December' }))
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-12-12')

  await userEvent.click(screen.getByRole('combobox', { name: /^Year/ }))
  await userEvent.click(await screen.findByRole('option', { name: '2030' }))
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2030-12-12')
})

it('keeps the day within the month when the month or year changes', async () => {
  vi.setSystemTime(new Date('2026-01-31T10:00:00'))
  renderScreen()
  await screen.findByRole('status')

  await userEvent.click(screen.getByRole('combobox', { name: /^Month/ }))
  await userEvent.click(await screen.findByRole('option', { name: 'February' }))

  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-02-28')
})

it('picks any date with the date picker, and opens it when tapped', async () => {
  const showPicker = vi.fn()
  Object.defineProperty(HTMLInputElement.prototype, 'showPicker', {
    configurable: true,
    value: showPicker,
  })
  try {
    renderScreen()
    await screen.findByRole('button', { name: /Standup/ })

    await userEvent.click(screen.getByLabelText('Choose a date'))
    expect(showPicker).toHaveBeenCalledOnce()

    fireEvent.change(screen.getByLabelText('Choose a date'), { target: { value: '2026-12-25' } })
    expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-12-25')
    expect(screen.getByRole('combobox', { name: /^Month/ })).toHaveTextContent('December')
  } finally {
    Reflect.deleteProperty(HTMLInputElement.prototype, 'showPicker')
  }
})

it('keeps the date and the week in place while only the events scroll', async () => {
  renderScreen()
  const list = (await screen.findByRole('button', { name: /Standup/ })).parentElement as HTMLElement

  expect(list).toHaveClass('overflow-y-auto')
  expect(list).not.toContainElement(screen.getByRole('group', { name: 'Week' }))
  expect(list).not.toContainElement(screen.getByRole('button', { name: 'Today' }))
})

it('starts the week on the day that was chosen, or the one of the browser region', async () => {
  const first = async () => {
    const week = await screen.findByRole('group', { name: 'Week' })
    return within(week).getAllByRole('button')[0]
  }

  storeSettings({ weekStart: 'sunday' })
  const sunday = renderScreen()
  expect(await first()).toHaveAccessibleName(/^Sunday, November 8/)
  sunday.unmount()

  storeSettings({ weekStart: 'saturday' })
  const saturday = renderScreen()
  expect(await first()).toHaveAccessibleName(/^Saturday, November 7/)
  saturday.unmount()

  storeSettings({}) // the system: the region of the browser
  const region = vi.spyOn(window.navigator, 'language', 'get')
  region.mockReturnValue('it-IT')
  const italy = renderScreen()
  expect(await first()).toHaveAccessibleName(/^Monday, November 9/)
  italy.unmount()

  region.mockReturnValue('en-US')
  renderScreen()
  expect(await first()).toHaveAccessibleName(/^Sunday, November 8/)
})

it('decides what today is in the time zone that was chosen', async () => {
  vi.setSystemTime(new Date('2026-11-12T12:00:00Z')) // noon in London: the next day on Kiritimati
  storeSettings({ weekStart: 'monday', timeZone: 'Pacific/Kiritimati' })
  const ahead = renderScreen()
  await screen.findByRole('status')
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-13')
  ahead.unmount()

  storeSettings({ weekStart: 'monday', timeZone: 'Pacific/Pago_Pago' })
  renderScreen()
  await screen.findByRole('status')
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-12')
})

it('creates a new event on the selected day', async () => {
  const { onCreate } = renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  await userEvent.click(day(/Saturday, November 14/))
  await userEvent.click(screen.getByRole('button', { name: 'New event' }))

  expect(onCreate).toHaveBeenCalledExactlyOnceWith('2026-11-14')
})

it('shows the date as day, month and year, without the name of the weekday', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // The weekday is in the names of the days of the week below, not in the line of the date.
  expect(screen.queryByText('Thursday')).not.toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date').parentElement).toHaveTextContent('12')
  expect(screen.getByRole('combobox', { name: 'Month: November' })).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Year: 2026' })).toBeInTheDocument()
})

it('shows the times in the habit of the language: 24 hours in Italian, AM and PM in English', async () => {
  const standup = async () => (await screen.findByRole('button', { name: /Standup/ })).textContent
  const english = renderScreen()
  expect(await standup()).toBe('9:00 AM9:30 AMStandup')
  english.unmount()

  await activateLocale('it')
  renderScreen()
  expect(await standup()).toBe('09:0009:30Standup')
})

it('offers ten years back and ten forward, and moves the list when a year is picked', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  const years = async () =>
    (await screen.findAllByRole('option')).map((option) => option.textContent)

  await userEvent.click(screen.getByRole('combobox', { name: /^Year/ }))
  const first = await years()
  expect(first).toHaveLength(21)
  expect(first[0]).toBe('2016')
  expect(first[10]).toBe('2026') // the selected year, in the middle
  expect(first[20]).toBe('2036')

  await userEvent.click(screen.getByRole('option', { name: '2036' }))
  await userEvent.click(screen.getByRole('combobox', { name: /^Year/ }))
  const next = await years()
  expect(next[0]).toBe('2026')
  expect(next[10]).toBe('2036')
  expect(next[20]).toBe('2046')
})
