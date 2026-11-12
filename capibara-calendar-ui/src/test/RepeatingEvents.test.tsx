import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import App from '../App'
import { activateLocale } from '../i18n'
import { deleteEvent, listCalendars, saveEvent, type CalendarEvent } from '../lib/caldav'
import { renderApp } from './render'
import { serveEvents } from './server'

vi.mock('../lib/caldav')

const ics = [
  'BEGIN:VCALENDAR',
  'VERSION:2.0',
  'BEGIN:VEVENT',
  'UID:1',
  'SUMMARY:Standup',
  'DTSTART:20261102T080000Z',
  'DTEND:20261102T083000Z',
  'RRULE:FREQ=WEEKLY',
  'END:VEVENT',
  'END:VCALENDAR',
  '',
].join('\r\n')

// Today is Thursday 12 November 2026; the occurrence of the week before was on Monday 9.
const standup: CalendarEvent = {
  uid: '1',
  calendarUrl: '/personal/',
  url: '/personal/1.ics',
  ics,
  title: 'Standup',
  description: '',
  startDate: '2026-11-12',
  startTime: '09:00',
  endDate: '2026-11-12',
  endTime: '09:30',
  isRecurring: true,
  occurrenceId: '20261112T080000Z',
}

beforeEach(() => {
  vi.setSystemTime(new Date('2026-11-12T10:00:00'))
  vi.mocked(listCalendars).mockResolvedValue([
    { url: '/personal/', name: 'Personal', color: '#2563eb' },
  ])
  serveEvents([standup])
  vi.mocked(saveEvent).mockResolvedValue()
  vi.mocked(deleteEvent).mockResolvedValue()
})

async function openOccurrence(choice?: 'Only this event' | 'This and following' | 'All events') {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Standup/ }))
  // The event is looked at first: which of its events to change is asked when the change begins.
  await userEvent.click(await screen.findByRole('button', { name: /^(Edit|Modifica)$/ }))
  if (choice) await userEvent.click(await screen.findByRole('button', { name: choice }))
}

it('asks which of the events to edit, before it opens one that repeats', async () => {
  await openOccurrence()

  expect(await screen.findByText('Edit a repeating event')).toBeInTheDocument()
  expect(
    screen.getByText(
      'Do you want to change only this event, this one and the ones after it, or all the events of the repeat?',
    ),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Only this event' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'This and following' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'All events' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit event' })).not.toBeInTheDocument()
})

it('stays on the event that is looked at when the question is not answered', async () => {
  await openOccurrence()
  await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

  await waitFor(() => {
    expect(screen.queryByText('Edit a repeating event')).not.toBeInTheDocument()
  })
  expect(screen.getByRole('heading', { name: 'Event' })).toBeInTheDocument() // not changed yet
  expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
})

it('does not ask which of the events to edit when a repeating event is only looked at', async () => {
  renderApp(<App />)

  await userEvent.click(await screen.findByRole('button', { name: /Standup/ }))

  expect(await screen.findByRole('heading', { name: 'Event' })).toBeInTheDocument()
  expect(screen.queryByText('Edit a repeating event')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Standup' })).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument() // text, not fields
  expect(screen.getByText(/^Every week/)).toBeInTheDocument() // how it repeats
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
})

it('does not ask about an event that does not repeat', async () => {
  serveEvents([{ ...standup, isRecurring: undefined }])
  renderApp(<App />)

  await userEvent.click(await screen.findByRole('button', { name: /Standup/ }))

  expect(await screen.findByRole('heading', { name: 'Standup' })).toBeInTheDocument()
  expect(screen.queryByText('Edit a repeating event')).not.toBeInTheDocument()
})

it('opens only that event, from its own day, with what is only of it', async () => {
  await openOccurrence('Only this event')

  expect(await screen.findByLabelText('Title')).toHaveValue('Standup')
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-12') // not the first of the repeat
  expect(
    screen.getByText('Only this event changes. The others of the repeat stay as they are.'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: 'Repeat' })).not.toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Calendar' })).toBeDisabled() // it is in its calendar
})

it('saves only that event, and goes back', async () => {
  await openOccurrence('Only this event')
  await userEvent.clear(await screen.findByLabelText('Title'))
  await userEvent.type(screen.getByLabelText('Title'), 'Standup, longer')

  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(saveEvent).toHaveBeenCalledOnce()
  })
  expect(saveEvent).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Standup, longer', startDate: '2026-11-12' }),
    standup,
    'one',
  )
  expect(await screen.findByRole('group', { name: 'Week' })).toBeInTheDocument()
})

it('deletes only that event, after it says that the others stay', async () => {
  await openOccurrence('Only this event')
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))

  const dialog = await screen.findByRole('alertdialog')
  expect(
    within(dialog).getByText('Only this event is deleted. The others of the repeat stay.'),
  ).toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

  await waitFor(() => {
    expect(deleteEvent).toHaveBeenCalledOnce()
  })
  expect(deleteEvent).toHaveBeenCalledWith(standup, 'one')
})

it('opens this event and the following ones from the day of the occurrence, with how they repeat', async () => {
  await openOccurrence('This and following')

  expect(await screen.findByLabelText('Title')).toHaveValue('Standup')
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-12') // the occurrence, not the first
  expect(
    screen.getByText('This event and the ones after it change. The ones before stay as they are.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Repeat' })).toHaveTextContent('Week')
  expect(screen.getByRole('combobox', { name: 'Calendar' })).toBeEnabled()
})

it('saves this event and the following ones, as the scope of the change', async () => {
  await openOccurrence('This and following')
  await userEvent.clear(await screen.findByLabelText('Title'))
  await userEvent.type(screen.getByLabelText('Title'), 'Standup, from now')

  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(saveEvent).toHaveBeenCalledOnce()
  })
  expect(saveEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      title: 'Standup, from now',
      startDate: '2026-11-12',
      repeat: 'WEEKLY',
    }),
    standup,
    'following',
  )
})

it('deletes this event and the following ones, after it says that the ones before stay', async () => {
  await openOccurrence('This and following')
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))

  const dialog = await screen.findByRole('alertdialog')
  expect(
    within(dialog).getByText('This event and the ones after it are deleted. The ones before stay.'),
  ).toBeInTheDocument()
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

  await waitFor(() => {
    expect(deleteEvent).toHaveBeenCalledWith(standup, 'following')
  })
})

it('opens all the events as the event, from the day it started on, with how it repeats', async () => {
  await openOccurrence('All events')

  expect(await screen.findByLabelText('Title')).toHaveValue('Standup')
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-02') // the first of the repeat
  expect(
    screen.getByText('This event repeats. Changes are made to all its occurrences.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Repeat' })).toHaveTextContent('Week')
  expect(screen.getByLabelText('Repeat every')).toHaveValue(1)
  expect(screen.getByRole('button', { name: 'Monday' })).toHaveAttribute('aria-pressed', 'true') // the day of the start
  expect(screen.getByRole('combobox', { name: 'How the repeat ends' })).toHaveTextContent(
    'Does not end',
  )
  expect(screen.queryByLabelText('Repeat until')).not.toBeInTheDocument()
})

it('saves all the events, and deletes all of them', async () => {
  await openOccurrence('All events')
  await userEvent.clear(await screen.findByLabelText('Title'))
  await userEvent.type(screen.getByLabelText('Title'), 'Daily standup')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(saveEvent).toHaveBeenCalledOnce()
  })
  expect(saveEvent).toHaveBeenCalledWith(
    expect.objectContaining({ title: 'Daily standup', startDate: '2026-11-02', repeat: 'WEEKLY' }),
    standup,
    'all',
  )
})

it('deletes all the events when that is the choice', async () => {
  await openOccurrence('All events')
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))
  const dialog = await screen.findByRole('alertdialog')
  expect(
    within(dialog).getByText('It repeats: all its occurrences are deleted.'),
  ).toBeInTheDocument()

  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

  await waitFor(() => {
    expect(deleteEvent).toHaveBeenCalledWith(standup, 'all')
  })
})

async function chooseRepeat(option: string) {
  await userEvent.click(await screen.findByRole('combobox', { name: 'Repeat' }))
  await userEvent.click(await screen.findByRole('option', { name: option }))
  await waitFor(() => {
    expect(screen.queryByRole('option')).not.toBeInTheDocument() // it is closed
  })
}

async function chooseEnding(option: string) {
  await userEvent.click(await screen.findByRole('combobox', { name: 'How the repeat ends' }))
  await userEvent.click(await screen.findByRole('option', { name: option }))
  await waitFor(() => {
    expect(screen.queryByRole('option')).not.toBeInTheDocument() // it is closed
  })
}

it('makes an event repeat, and says on which day it ends', async () => {
  serveEvents([{ ...standup, isRecurring: undefined }])
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Standup/ }))
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  expect(await screen.findByRole('combobox', { name: 'Repeat' })).toHaveTextContent(
    'Does not repeat',
  )
  expect(screen.queryByLabelText('Repeat every')).not.toBeInTheDocument() // nothing to say yet

  await chooseRepeat('Month')
  await chooseEnding('Ends on')
  await userEvent.type(screen.getByLabelText('Repeat until'), '2027-06-30')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(saveEvent).toHaveBeenCalledOnce()
  })
  expect(saveEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      repeat: 'MONTHLY',
      repeatInterval: '1',
      repeatEnds: 'on',
      repeatUntil: '2027-06-30',
    }),
    expect.anything(),
    undefined,
  )
})

it('has the rows of the repeat, once the event repeats: the select is the whole row until then', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'New event' }))
  const labels = () =>
    screen.queryAllByText(/^(Every|Repeat on|Ends)$/).map((item) => item.textContent)
  expect(labels()).toEqual(['Ends']) // the end of the event itself
  expect(screen.getByRole('combobox', { name: 'Repeat' })).toHaveTextContent('Does not repeat')
  expect(screen.queryByLabelText('Repeat every')).not.toBeInTheDocument()

  await chooseRepeat('Day')
  expect(labels()).toEqual(['Ends', 'Every'])
  expect(screen.getByLabelText('Repeat every')).toHaveValue(1)
  expect(screen.getByRole('combobox', { name: 'Repeat' })).toHaveTextContent('Day')
  expect(screen.getByRole('combobox', { name: 'How the repeat ends' })).toHaveTextContent(
    'Does not end',
  )

  await chooseRepeat('Week')
  expect(labels()).toEqual(['Ends', 'Every', 'Repeat on'])

  await chooseRepeat('Year')
  await waitFor(() => {
    expect(labels()).toEqual(['Ends', 'Every']) // the days are for a week, gone when they went out
  })
})

it('says every so many days, weeks, months or years, in the singular and the plural', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'New event' }))
  await chooseRepeat('Day')
  const unit = () => screen.getByRole('combobox', { name: 'Repeat' }).textContent.replace('▼', '')
  expect(unit()).toBe('Day')

  await userEvent.clear(screen.getByLabelText('Repeat every'))
  await userEvent.type(screen.getByLabelText('Repeat every'), '3')
  expect(unit()).toBe('Days')

  await chooseRepeat('Months') // for 3, the options are in the plural
  expect(unit()).toBe('Months')
  await userEvent.clear(screen.getByLabelText('Repeat every'))
  await userEvent.type(screen.getByLabelText('Repeat every'), '1')
  expect(unit()).toBe('Month')
})

it('saves every so many weeks, on the days that are chosen, and for how many times', async () => {
  serveEvents([{ ...standup, isRecurring: undefined }])
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Standup/ }))
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  await chooseRepeat('Week')
  await userEvent.clear(screen.getByLabelText('Repeat every'))
  await userEvent.type(screen.getByLabelText('Repeat every'), '2')
  expect(screen.getByRole('button', { name: 'Thursday' })).toHaveAttribute('aria-pressed', 'true') // the day of the event
  await userEvent.click(screen.getByRole('button', { name: 'Monday' }))
  await userEvent.click(screen.getByRole('button', { name: 'Saturday' }))
  await chooseEnding('Ends after')
  await userEvent.type(screen.getByLabelText('Repeat this many times'), '8')
  expect(screen.getByText('times')).toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(saveEvent).toHaveBeenCalledOnce()
  })
  expect(saveEvent).toHaveBeenCalledWith(
    expect.objectContaining({
      repeat: 'WEEKLY',
      repeatInterval: '2',
      repeatDays: ['MO', 'TH', 'SA'], // in the order of the week, whatever the order of the taps
      repeatEnds: 'after',
      repeatCount: '8',
    }),
    expect.anything(),
    undefined,
  )
})

it('keeps one day of the week at least: a repeat every week is on one', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'New event' }))
  await chooseRepeat('Week')
  const days = () =>
    screen
      .getAllByRole('button', { pressed: true })
      .map((button) => button.querySelector('.sr-only')?.textContent)
  expect(days()).toHaveLength(1)
  const [only] = days()

  await userEvent.click(screen.getByRole('button', { name: only ?? '' }))

  expect(days()).toEqual([only])
})

it('starts the days of the week where the week starts', async () => {
  localStorage.setItem('capibara-calendar-settings', JSON.stringify({ weekStart: 'sunday' }))
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'New event' }))

  await chooseRepeat('Week')

  const row = screen.getByRole('button', { name: 'Sunday' }).parentElement as HTMLElement
  expect(
    within(row)
      .getAllByRole('button')
      .map((button) => button.querySelector('.sr-only')?.textContent),
  ).toEqual(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'])
})

it('asks for a number of one or more, for how often and for how many times', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'New event' }))
  await userEvent.type(screen.getByLabelText('Title'), 'Gym')
  await chooseRepeat('Day')
  await userEvent.clear(screen.getByLabelText('Repeat every'))
  await userEvent.type(screen.getByLabelText('Repeat every'), '0')
  await chooseEnding('Ends after')

  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(screen.getAllByText('Enter a number, 1 or more')).toHaveLength(2) // both
  })
  expect(saveEvent).not.toHaveBeenCalled()
})

it('asks for the day that the repeat ends on, when it is to end on one', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'New event' }))
  await userEvent.type(screen.getByLabelText('Title'), 'Gym')
  await chooseRepeat('Day')
  await chooseEnding('Ends on')

  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Choose the day that the repeat ends')).toBeInTheDocument()
  expect(saveEvent).not.toHaveBeenCalled()
})

it('has every way to repeat, and none of them for an event that is new', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'New event' }))

  await userEvent.click(await screen.findByRole('combobox', { name: 'Repeat' }))

  const options = (await screen.findAllByRole('option')).map((option) => option.textContent)
  expect(options).toEqual(['Does not repeat', 'Day', 'Week', 'Month', 'Year'])
})

it('does not let the repeat end before the event starts', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'New event' }))
  await userEvent.type(screen.getByLabelText('Title'), 'Gym')
  await chooseRepeat('Day')
  await chooseEnding('Ends on')
  await userEvent.type(screen.getByLabelText('Repeat until'), '2026-11-01')

  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  expect(
    await screen.findByText('The repeat cannot end before the event starts'),
  ).toBeInTheDocument()
  expect(saveEvent).not.toHaveBeenCalled()
})

it('takes the repeat away from an event, which then has none', async () => {
  await openOccurrence('All events')
  await chooseRepeat('Does not repeat')
  expect(screen.queryByLabelText('Repeat until')).not.toBeInTheDocument()

  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(saveEvent).toHaveBeenCalledOnce()
  })
  expect(saveEvent).toHaveBeenCalledWith(expect.objectContaining({ repeat: '' }), standup, 'all')
})

it('keeps a repeat that the form cannot say as it is, and says so', async () => {
  const custom = {
    ...standup,
    ics: ics.replace('RRULE:FREQ=WEEKLY', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=1,15'),
  }
  serveEvents([custom])
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Standup/ }))
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  await userEvent.click(await screen.findByRole('button', { name: 'All events' }))

  expect(await screen.findByRole('combobox', { name: 'Repeat' })).toHaveTextContent(
    'Custom, kept as it is',
  )
  expect(screen.queryByLabelText('Repeat every')).not.toBeInTheDocument() // the rows cannot say it
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => {
    expect(saveEvent).toHaveBeenCalledWith(
      expect.objectContaining({ repeat: 'custom' }),
      custom,
      'all',
    )
  })
})

it('is in the language of the app', async () => {
  await activateLocale('it')
  await openOccurrence()

  expect(await screen.findByText('Modifica un evento ripetuto')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Solo questo evento' })).toBeInTheDocument()
  await userEvent.click(screen.getByRole('button', { name: 'Tutti gli eventi' }))

  expect(await screen.findByRole('combobox', { name: 'Ripeti' })).toHaveTextContent('Settimana')
  expect(screen.getByLabelText('Ripeti ogni')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'lunedì' })).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Come finisce la ripetizione' })).toHaveTextContent(
    'Non finisce',
  )
})

it('has the end of the repeat as three sentences: it does not end, ends on a day, ends after some times', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'New event' }))
  await chooseRepeat('Month')

  await userEvent.click(screen.getByRole('combobox', { name: 'How the repeat ends' }))
  const options = (await screen.findAllByRole('option')).map((option) => option.textContent)
  expect(options).toEqual(['Does not end', 'Ends on', 'Ends after'])
  await userEvent.keyboard('{Escape}')
  await waitFor(() => {
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  await chooseEnding('Ends on')
  expect(screen.getByLabelText('Repeat until')).toBeInTheDocument()
  expect(screen.queryByLabelText('Repeat this many times')).not.toBeInTheDocument()
  await chooseEnding('Ends after')
  expect(screen.getByLabelText('Repeat this many times')).toBeInTheDocument()
  expect(screen.getByText('times')).toBeInTheDocument()
  await waitFor(() => {
    expect(screen.queryByLabelText('Repeat until')).not.toBeInTheDocument() // it is gone when it went out
  })
  await chooseEnding('Does not end')
  await waitFor(() => {
    expect(screen.queryByLabelText('Repeat this many times')).not.toBeInTheDocument()
  })
})

it('has the units with a capital, in the list and in the row', async () => {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'New event' }))
  await chooseRepeat('Week')
  await userEvent.clear(screen.getByLabelText('Repeat every'))
  await userEvent.type(screen.getByLabelText('Repeat every'), '4')

  await userEvent.click(screen.getByRole('combobox', { name: 'Repeat' }))

  const options = (await screen.findAllByRole('option')).map((option) => option.textContent)
  expect(options).toEqual(['Does not repeat', 'Days', 'Weeks', 'Months', 'Years']) // for 4: the plural
  await userEvent.click(screen.getByRole('option', { name: 'Weeks' }))
  expect(screen.getByRole('combobox', { name: 'Repeat' })).toHaveTextContent(/^Weeks/)
})
