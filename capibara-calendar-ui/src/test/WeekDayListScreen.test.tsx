import type { CalendarEvent } from './legacy'
import { getApi, resetApi } from '../api'
import { fireEvent, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { activateLocale } from '../i18n'
import DaysScreen from '../screens/DaysScreen'
import { pagerOf, scrollToPage } from './pager'
import { renderApp } from './render'
import { contractOf, forRange, keyOf, serveEvents } from './server'

vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  resetApi: vi.fn(),
}))

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
  serveEvents(events)
  storeSettings({ weekStart: 'monday' }) // English defaults to Sunday
})

afterEach(() => {
  vi.useRealTimers()
})

const day = (label: RegExp) => screen.getByRole('button', { name: label })

function renderScreen() {
  const handlers = {
    onCreate: vi.fn(),
    onEdit: vi.fn(),
    onOpenSettings: vi.fn(),
    onOpenLayouts: vi.fn(),
    onOpenCalendars: vi.fn(),
    onOpenFilters: vi.fn(),
    onOpenView: vi.fn(),
  }
  const view = renderApp(<DaysScreen {...handlers} />)
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
  expect(buttons.map((button) => button.textContent)).toEqual(['Conference', 'Standup09:0009:30'])
})

it('shows another day when it is tapped, and says so when nothing is planned', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  await userEvent.click(day(/Saturday, November 14/))
  expect(day(/Saturday, November 14/)).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-14')
  expect(screen.getByRole('button', { name: /Conference/ })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Hike/ })).toHaveTextContent('Hike10:0014:00')
  expect(screen.queryByRole('button', { name: /Standup/ })).not.toBeInTheDocument()

  await userEvent.click(day(/Monday, November 9/))
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-09')
  expect(screen.queryByRole('button', { name: /Standup|Conference|Hike/ })).not.toBeInTheDocument()
  expect(screen.getByText('Nothing planned')).toBeInTheDocument()
  expect(screen.getByText('A free day. Enjoy it.')).toBeInTheDocument()
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

  expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ title: events[0].title }))
  expect(onCreate).toHaveBeenCalledExactlyOnceWith('2026-11-12') // the selected day, today
  expect(onOpenSettings).toHaveBeenCalledOnce()
})

it('opens the layouts with the selected day', async () => {
  const { onOpenLayouts } = renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  await userEvent.click(day(/Saturday, November 14/))
  await userEvent.click(screen.getByRole('button', { name: 'Layouts' }))

  expect(onOpenLayouts).toHaveBeenCalledExactlyOnceWith('2026-11-14')
})

it('is in the language of the app', async () => {
  await activateLocale('it')
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(day(/giovedì 12 novembre 2026: 2 eventi/)).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Mese: Novembre' })).toHaveTextContent('Novembre')
  expect(screen.getByText('Lun')).toBeInTheDocument() // the names of the days, above them
  expect(screen.getByRole('button', { name: 'Oggi' })).toBeInTheDocument()
  await userEvent.click(day(/lunedì 9 novembre 2026/))
  expect(day(/lunedì 9 novembre 2026/)).toHaveAttribute('aria-pressed', 'true')
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
  const list = (await screen.findByRole('button', { name: /Standup/ })).closest(
    'section',
  ) as HTMLElement

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

it('shows the date as the name of the day, the day, the month and the year', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(screen.getByText('Thursday')).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date').parentElement).toHaveTextContent('12')
  expect(screen.getByRole('combobox', { name: 'Month: November' })).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Year: 2026' })).toBeInTheDocument()
})

it('shows the times in 24 hours, in English and in Italian', async () => {
  const standup = async () => (await screen.findByRole('button', { name: /Standup/ })).textContent
  const english = renderScreen()
  expect(await standup()).toBe('Standup09:0009:30')
  english.unmount()

  await activateLocale('it')
  renderScreen()
  expect(await standup()).toBe('Standup09:0009:30')
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

const weekPager = () => pagerOf(screen.getByRole('group', { name: 'Week' }))
const swipe = (direction: 'next' | 'previous') =>
  scrollToPage(weekPager(), 'x', direction === 'next' ? 2 : 0)

it('has the week before and the week after beside the week, for what is scrolled to', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(weekPager().children).toHaveLength(3)
  const hidden = (label: RegExp) => screen.getAllByRole('button', { name: label, hidden: true })
  expect(hidden(/Monday, November 2, 2026/)[0].closest('[aria-hidden="true"]')).not.toBeNull()
  expect(hidden(/Monday, November 16, 2026/)[0].closest('[aria-hidden="true"]')).not.toBeNull()
  // The counts of the weeks beside are there, to be seen while it scrolls.
  expect(hidden(/Monday, November 16, 2026: 1 event/)).toHaveLength(1)
  // And only the week that is shown is for the person that reads or taps.
  expect(screen.getAllByRole('group', { name: 'Week' })).toHaveLength(1)
  expect(screen.queryByRole('button', { name: /Monday, November 16/ })).not.toBeInTheDocument()
})

it('goes to the next week when it stops on it, and to the week before when it stops on that', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  await swipe('next')
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-19') // the same weekday
  expect(
    within(screen.getByRole('group', { name: 'Week' })).getAllByRole('button')[0],
  ).toHaveAccessibleName(/^Monday, November 16/)
  expect(
    await screen.findByRole('button', { name: /Monday, November 16, 2026: 1 event/ }),
  ).toBeInTheDocument()

  await swipe('previous')
  await swipe('previous')
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-05')
})

it('stays on the week when it stops on the page that is shown, and a tap on a day selects it', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  await scrollToPage(weekPager(), 'x', 1)
  await userEvent.click(day(/Saturday, November 14/))

  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-14')
})

const starts = () =>
  vi
    .mocked(getApi().listEvents)
    .mock.calls.map(([, range]) => range.start)
    .sort()

it('asks the server for the month of the week and the months beside it, and for no other after it moves', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  await vi.waitFor(() => {
    expect(starts()).toEqual([
      '2026-10-01', // the month before
      '2026-11-01', // the month of the week
      '2026-12-01', // the month after
    ])
  })

  await swipe('next')
  await swipe('next') // the weeks of the month, and the one after it: it has what it needs
  await vi.waitFor(() => {
    expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-26')
  })
  expect(getApi().listEvents).toHaveBeenCalledTimes(3)

  await swipe('next') // the week that is in two months: the month after the next is asked for
  await vi.waitFor(() => {
    expect(getApi().listEvents).toHaveBeenCalledTimes(4)
  })
  expect(getApi().listEvents).toHaveBeenLastCalledWith(
    ...forRange('/c/', {
      start: '2027-01-01',
      end: '2027-01-31',
    }),
  )
})

it('keeps the screen as it was while the next week is on its way', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  vi.mocked(getApi().listEvents).mockReturnValue(new Promise(() => undefined)) // never comes

  await swipe('next')

  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-19')
  expect(screen.getByText('Connected to the CalDAV server')).toBeInTheDocument() // not an error
})

it('opens the filter from the bottom bar', async () => {
  const { onOpenCalendars } = renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  await userEvent.click(screen.getByRole('button', { name: 'Calendars' }))

  expect(onOpenCalendars).toHaveBeenCalledOnce()
})

it('does not show the events of the calendars that are hidden', async () => {
  serveEvents([
    event('Standup', { startTime: '09:00', endTime: '09:30' }),
    event('Secret', { calendarUrl: '/hidden/' }),
    event('Planning', { startDate: '2026-11-13', calendarUrl: '/hidden/' }),
  ])
  localStorage.setItem('capibara-calendar-hidden-calendars', JSON.stringify([keyOf('/hidden/')]))
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  expect(screen.queryByRole('button', { name: /Secret/ })).not.toBeInTheDocument()
  expect(day(/Thursday, November 12, 2026: 1 event$/)).toBeInTheDocument() // the count too
  expect(day(/Friday, November 13, 2026$/)).toBeInTheDocument()
})

it('has the color of the calendar as the left border of the title of each event', async () => {
  serveEvents([
    event('Standup', { startTime: '09:00', color: '#2563eb' }),
    event('Review', { calendarUrl: '/work/', color: '#dc2626' }),
    event('Plain', {}),
  ])
  renderScreen()
  const standup = await screen.findByRole('button', { name: /Standup/ })

  const edge = (button: HTMLElement) =>
    button.querySelector<HTMLElement>('[data-slot="calendar-color"]') as HTMLElement
  expect(edge(standup).style.borderRightColor).toBe('rgb(37, 99, 235)')
  expect(edge(standup)).toHaveClass('border-r-4') // 4px
  expect(edge(screen.getByRole('button', { name: /Review/ })).style.borderRightColor).toBe(
    'rgb(220, 38, 38)',
  )
  const plain = edge(screen.getByRole('button', { name: /Plain/ }))
  expect(plain.style.borderRightColor).toBe('') // no color: no border
  expect(plain).not.toHaveClass('border-r-4')
  expect(standup).toHaveAccessibleName(/^Standup09:00$/) // the color says nothing in words
})

it('has the refresh button next to the settings, which asks the server for everything again', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  const bar = screen.getByRole('button', { name: 'Settings' }).parentElement as HTMLElement
  expect(
    within(bar)
      .getAllByRole('button')
      .map((button) => button.getAttribute('aria-label')),
  ).toEqual(['Settings', 'Refresh'])
  await vi.waitFor(() => {
    expect(getApi().listEvents).toHaveBeenCalledTimes(3)
  })

  await userEvent.click(screen.getByRole('button', { name: 'Refresh' }))

  expect(resetApi).toHaveBeenCalledOnce() // the calendars and colors are read again too
  await vi.waitFor(() => {
    expect(getApi().listEvents).toHaveBeenCalledTimes(4) // what is on the screen, whatever the calendar said
  })
})

it('shows that it is refreshing, and stops when it is done', async () => {
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  const refresh = screen.getByRole('button', { name: 'Refresh' })
  await vi.waitFor(() => {
    expect(refresh).toHaveAttribute('aria-busy', 'false')
  })
  expect(refresh.querySelector('svg')).not.toHaveClass('animate-spin')

  let finish = () => {}
  vi.mocked(getApi().listEvents).mockReturnValue(
    new Promise<Awaited<ReturnType<ReturnType<typeof getApi>['listEvents']>>>((resolve) => {
      finish = () => {
        resolve(events.map(contractOf))
      }
    }),
  )
  await userEvent.click(refresh)

  await vi.waitFor(() => {
    expect(refresh).toHaveAttribute('aria-busy', 'true')
  })
  expect(refresh.querySelector('svg')).toHaveClass('animate-spin')
  finish()
  await vi.waitFor(() => {
    expect(refresh).toHaveAttribute('aria-busy', 'false')
  })
})
