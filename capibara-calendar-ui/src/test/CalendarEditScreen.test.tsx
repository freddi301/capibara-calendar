import { calendarInfoOf, keyOf, serveEvents } from './server'
import type { CalendarInfo } from './legacy'
import { getApi } from '../api'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { fireEvent } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import { activateLocale } from '../i18n'
import { palette } from '../lib/calendar-color'
import { HttpError } from '../lib/errors'
import { hiddenCalendars, saveHiddenCalendars } from '../lib/filter'
import CalendarEditScreen from '../screens/CalendarEditScreen'
import { createQueryClient } from '../lib/query-client'
import { renderApp } from './render'

const work: CalendarInfo = { url: '/work/', name: 'Work', color: '#dc2626' }
const personal: CalendarInfo = { url: '/personal/', name: 'Personal', color: '#2563eb' }

beforeEach(() => {
  serveEvents([], [personal, work])
})

function renderScreen(calendar?: CalendarInfo) {
  const onClose = vi.fn()
  const client = createQueryClient()
  renderApp(
    <CalendarEditScreen calendar={calendar && calendarInfoOf(calendar)} onClose={onClose} />,
    client,
  )
  return { onClose, client }
}

const name = () => screen.getByLabelText('Name')
const button = (label: string) => screen.getByRole('button', { name: label })
const pressed = () =>
  screen.getAllByRole('button', { pressed: true }).map((item) => item.getAttribute('aria-label'))

it('is for a new calendar when none is given, with its name to type in', async () => {
  renderScreen()

  expect(await screen.findByText('New calendar')).toBeInTheDocument()
  await waitFor(() => {
    expect(name()).toHaveFocus()
  })
  expect(name()).toHaveValue('')
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
})

it('starts a new calendar with a color that the other calendars do not have', async () => {
  serveEvents(
    [],
    [
      { url: '/a/', name: 'A', color: palette[0].color },
      { url: '/b/', name: 'B', color: palette[1].color },
      { url: '/c/', name: 'C', color: '#123456' },
    ],
  )
  renderScreen()

  await waitFor(() => {
    expect(pressed()).toEqual(['Green']) // blue and red are taken
  })
})

it('makes the calendar with the name and the color, and goes back', async () => {
  const { onClose } = renderScreen()
  await userEvent.type(name(), '  Family  ')
  await userEvent.click(button('Violet'))

  await userEvent.click(button('Save'))

  await waitFor(() => {
    expect(onClose).toHaveBeenCalledOnce()
  })
  expect(getApi().createCalendar).toHaveBeenCalledExactlyOnceWith(expect.anything(), {
    name: 'Family',
    color: '#7c3aed',
  })
  expect(getApi().updateCalendar).not.toHaveBeenCalled()
})

it('asks for a name, and does not make a calendar without one', async () => {
  const { onClose } = renderScreen()

  await userEvent.click(button('Save'))

  expect(await screen.findByText('Enter a name')).toBeInTheDocument()
  await userEvent.type(name(), '   ')
  await userEvent.click(button('Save'))
  expect(await screen.findByText('Enter a name')).toBeInTheDocument()
  expect(getApi().createCalendar).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
})

it('is for the calendar that is given, with its name and its color', async () => {
  renderScreen(work)

  expect(await screen.findByText('Edit calendar')).toBeInTheDocument()
  expect(name()).toHaveValue('Work')
  expect(pressed()).toEqual(['Red'])
  expect(screen.getByLabelText('Custom color')).toHaveValue('#dc2626')
  expect(name()).not.toHaveFocus()
  expect(button('Delete')).toBeInTheDocument()
})

it('changes the name and the color of the calendar, and goes back', async () => {
  const { onClose } = renderScreen(work)
  await userEvent.clear(name())
  await userEvent.type(name(), 'Office')
  await userEvent.click(button('Teal'))

  await userEvent.click(button('Save'))

  await waitFor(() => {
    expect(onClose).toHaveBeenCalledOnce()
  })
  expect(getApi().updateCalendar).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ calendarId: work.url }),
    { name: 'Office', color: '#0d9488' },
  )
  expect(getApi().createCalendar).not.toHaveBeenCalled()
})

it('has a color that is not one of the palette, from the color of the system', async () => {
  const { onClose } = renderScreen(work)

  fireEvent.change(screen.getByLabelText('Custom color'), { target: { value: '#123abc' } })

  expect(screen.getByText('#123abc')).toBeInTheDocument()
  expect(screen.queryAllByRole('button', { pressed: true })).toHaveLength(0) // none of the palette
  await userEvent.click(button('Save'))
  await waitFor(() => {
    expect(onClose).toHaveBeenCalledOnce()
  })
  expect(getApi().updateCalendar).toHaveBeenCalledWith(
    expect.objectContaining({ calendarId: work.url }),
    { name: 'Work', color: '#123abc' },
  )
})

it('shows every color of the palette by its name, and the chosen one', async () => {
  renderScreen(work)
  await screen.findByText('Edit calendar')

  const swatches = within(
    screen.getByText('Color').closest('fieldset') as HTMLElement,
  ).getAllByRole('button')
  expect(swatches).toHaveLength(palette.length)
  expect(swatches.map((swatch) => swatch.style.backgroundColor)).toHaveLength(20)
  expect(swatches[1]).toHaveAccessibleName('Red')
  expect(swatches[1]).toHaveAttribute('aria-pressed', 'true')
  expect(swatches[0]).toHaveAttribute('aria-pressed', 'false')

  await userEvent.click(swatches[4])
  expect(pressed()).toEqual(['Violet'])
})

it('refreshes the calendars and the events that were asked for, when it saves', async () => {
  const { client } = renderScreen(work)
  client.setQueryData(['events', keyOf('/work/'), '2026-11'], { stamp: 'v1', events: [] })
  client.setQueryData(['events', keyOf('/home/'), '2026-11'], { stamp: 'v1', events: [] })
  await screen.findByText('Edit calendar')

  await userEvent.click(button('Save'))

  await waitFor(() => {
    expect(client.getQueryState(['events', keyOf('/work/'), '2026-11'])?.isInvalidated).toBe(true)
  })
  expect(client.getQueryState(['events', keyOf('/home/'), '2026-11'])?.isInvalidated).toBe(false) // another calendar
  await waitFor(() => {
    expect(getApi().listCalendars).toHaveBeenCalledTimes(2) // asked again: the screen shows them
  })
})

it('asks before it deletes the calendar, and says that its events go too', async () => {
  const { onClose } = renderScreen(work)
  await screen.findByText('Edit calendar')

  await userEvent.click(button('Delete'))

  expect(await screen.findByText('Delete this calendar?')).toBeInTheDocument()
  expect(
    screen.getByText('All its events are deleted with it. This cannot be undone.'),
  ).toBeInTheDocument()
  expect(getApi().deleteCalendar).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
  await waitFor(() => {
    expect(screen.queryByText('Delete this calendar?')).not.toBeInTheDocument()
  })
  expect(getApi().deleteCalendar).not.toHaveBeenCalled()
  expect(onClose).not.toHaveBeenCalled()
})

it('deletes the calendar when it is confirmed, forgets that it was hidden, and goes back', async () => {
  saveHiddenCalendars([keyOf('/work/'), keyOf('/personal/')])
  const { onClose } = renderScreen(work)
  await screen.findByText('Edit calendar')

  await userEvent.click(button('Delete'))
  const dialog = await screen.findByRole('alertdialog')
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

  await waitFor(() => {
    expect(onClose).toHaveBeenCalledOnce()
  })
  expect(getApi().deleteCalendar).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ calendarId: work.url }),
  )
  expect(hiddenCalendars()).toEqual([keyOf('/personal/')]) // the one that is not deleted stays hidden
})

it('keeps what was typed, says what went wrong, and saves when it is tried again', async () => {
  vi.mocked(getApi().updateCalendar).mockRejectedValueOnce(new TypeError('Failed to fetch'))
  const { onClose } = renderScreen(work)
  await userEvent.clear(name())
  await userEvent.type(name(), 'Office')

  await userEvent.click(button('Save'))

  expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the CalDAV server')
  expect(name()).toHaveValue('Office')
  expect(onClose).not.toHaveBeenCalled()

  await userEvent.click(button('Try again'))

  await waitFor(() => {
    expect(onClose).toHaveBeenCalledOnce()
  })
  expect(getApi().updateCalendar).toHaveBeenCalledTimes(2)
})

it('says that the server did not allow it, without offering to try again', async () => {
  vi.mocked(getApi().createCalendar).mockRejectedValue(new HttpError(403))
  renderScreen()
  await userEvent.type(name(), 'Family')

  await userEvent.click(button('Save'))

  expect(await screen.findByRole('alert')).toHaveTextContent('The server did not allow this.')
  expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument()
})

it('says that the calendar could not be saved, for a server that failed', async () => {
  vi.mocked(getApi().updateCalendar).mockRejectedValue(new HttpError(500))
  renderScreen(work)

  await userEvent.click(button('Save'))

  expect(await screen.findByRole('alert')).toHaveTextContent('The calendar could not be saved.')
  expect(button('Try again')).toBeInTheDocument()
})

it('says what went wrong when the calendar cannot be deleted, and deletes it when it is tried again', async () => {
  vi.mocked(getApi().deleteCalendar).mockRejectedValueOnce(new HttpError(503))
  const { onClose } = renderScreen(work)
  await screen.findByText('Edit calendar')

  await userEvent.click(button('Delete'))
  await userEvent.click(
    within(await screen.findByRole('alertdialog')).getByRole('button', { name: 'Delete' }),
  )

  expect(await screen.findByRole('alert')).toHaveTextContent('The calendar could not be deleted.')
  expect(onClose).not.toHaveBeenCalled()

  await userEvent.click(button('Try again'))
  await waitFor(() => {
    expect(getApi().deleteCalendar).toHaveBeenCalledTimes(2)
  })
})

it('does not let it be saved or deleted again while it is being saved', async () => {
  vi.mocked(getApi().updateCalendar).mockReturnValue(new Promise(() => undefined))
  renderScreen(work)

  await userEvent.click(button('Save'))

  await waitFor(() => {
    expect(button('Save')).toBeDisabled()
  })
  expect(button('Delete')).toBeDisabled()
})

it('is in the language of the app', async () => {
  await activateLocale('it')
  renderScreen(work)

  expect(await screen.findByText('Modifica calendario')).toBeInTheDocument()
  expect(screen.getByLabelText('Nome')).toBeInTheDocument()
  expect(screen.getByText('Colore')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Rosso' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByLabelText('Colore personalizzato')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Elimina' })).toBeInTheDocument()
})
