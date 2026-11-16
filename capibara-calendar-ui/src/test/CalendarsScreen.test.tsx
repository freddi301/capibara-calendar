import { getApi } from '../api'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { activateLocale } from '../i18n'
import { getStored } from '../lib/use-stored'
import CalendarsScreen from '../screens/CalendarsScreen'
import { renderApp } from './render'
import { keyOf, serveEvents } from './server'
import { seedStored } from './support/stored'

beforeEach(() => {
  serveEvents(
    [],
    [
      { url: '/personal/', name: 'Personal', color: '#2563eb' },
      { url: '/work/', name: 'Work', color: '#dc2626' },
      { url: '/family/', name: 'Family', color: '#16a34a' },
    ],
  )
})

function renderScreen() {
  const onClose = vi.fn()
  const onEditCalendar = vi.fn()
  const onExport = vi.fn()
  const onImport = vi.fn()
  renderApp(
    <CalendarsScreen
      onClose={onClose}
      onEditCalendar={onEditCalendar}
      onExport={onExport}
      onImport={onImport}
    />,
  )
  return Object.assign(onClose, { onEditCalendar, onExport, onImport })
}

const calendar = (name: string) => screen.getByRole('switch', { name })
const button = (name: string) => screen.getByRole('button', { name })

it('shows every calendar as shown, until some are hidden', async () => {
  renderScreen()

  expect(await screen.findByRole('heading', { name: 'Calendars' })).toBeInTheDocument()
  expect(await screen.findByRole('switch', { name: 'Personal' })).toBeChecked()
  expect(calendar('Work')).toBeChecked()
  expect(calendar('Family')).toBeChecked()
  expect(getStored().hiddenCalendars).toEqual([])
})

it('hides a calendar with its switch, remembers it, and shows it again', async () => {
  renderScreen()
  await userEvent.click(await screen.findByRole('switch', { name: 'Work' }))

  expect(calendar('Work')).not.toBeChecked()
  expect(calendar('Personal')).toBeChecked()
  expect(getStored().hiddenCalendars).toEqual([keyOf('/work/')])

  await userEvent.click(calendar('Work'))

  expect(calendar('Work')).toBeChecked()
  expect(getStored().hiddenCalendars).toEqual([])
})

it('opens the calendar when its name is tapped, and does not hide it', async () => {
  const onClose = renderScreen()
  await screen.findByRole('switch', { name: 'Family' })

  await userEvent.click(screen.getByText('Family'))

  expect(onClose.onEditCalendar).toHaveBeenCalledExactlyOnceWith(
    expect.objectContaining({ url: keyOf('/family/'), name: 'Family', color: '#16a34a' }),
  )
  expect(calendar('Family')).toBeChecked()
  expect(getStored().hiddenCalendars).toEqual([])
})

it('hides a calendar only with its switch, and does not open it', async () => {
  const onClose = renderScreen()
  await userEvent.click(await screen.findByRole('switch', { name: 'Family' }))

  expect(calendar('Family')).not.toBeChecked()
  expect(getStored().hiddenCalendars).toEqual([keyOf('/family/')])
  expect(onClose.onEditCalendar).not.toHaveBeenCalled()
})

it('has New calendar at the top of the list of the calendars, which opens a new one', async () => {
  const onClose = renderScreen()
  await screen.findByRole('switch', { name: 'Personal' })

  // The buttons to import and to export have an icon and no text, and are the first of the row.
  const rows = screen.getAllByRole('button').map((item) => item.textContent)
  expect(rows.slice(0, 8)).toEqual([
    '',
    '',
    'Show all',
    'Hide all',
    'New calendar',
    'Personal',
    'Work',
    'Family',
  ])
  await userEvent.click(screen.getByRole('button', { name: 'New calendar' }))

  expect(onClose.onEditCalendar).toHaveBeenCalledExactlyOnceWith()
})

it('has Hide all and Show all above the list of the calendars', async () => {
  renderScreen()
  await screen.findByRole('switch', { name: 'Work' })
  const buttons = screen.getAllByRole('button').map((item) => item.textContent)
  expect(buttons.slice(0, 4)).toEqual(['', '', 'Show all', 'Hide all'])
  expect(screen.getByRole('heading', { name: 'Calendars' })).toBeInTheDocument()

  await userEvent.click(button('Hide all'))

  for (const name of ['Personal', 'Work', 'Family']) expect(calendar(name)).not.toBeChecked()
  expect(getStored().hiddenCalendars).toEqual([
    keyOf('/personal/'),
    keyOf('/work/'),
    keyOf('/family/'),
  ])

  await userEvent.click(button('Show all'))

  for (const name of ['Personal', 'Work', 'Family']) expect(calendar(name)).toBeChecked()
  expect(getStored().hiddenCalendars).toEqual([])
})

it('only offers what can change something', async () => {
  renderScreen()
  await screen.findByRole('switch', { name: 'Work' })
  expect(button('Show all')).toBeDisabled() // all are shown already
  expect(button('Hide all')).toBeEnabled()

  await userEvent.click(calendar('Work'))
  expect(button('Show all')).toBeEnabled()
  expect(button('Hide all')).toBeEnabled()

  await userEvent.click(button('Hide all'))
  expect(button('Hide all')).toBeDisabled() // all are hidden already
})

it('starts from what was hidden before', async () => {
  seedStored({ hiddenCalendars: [keyOf('/personal/')] })
  renderScreen()

  expect(await screen.findByRole('switch', { name: 'Personal' })).not.toBeChecked()
  expect(calendar('Work')).toBeChecked()
})

it('keeps the ones that are hidden, whether the calendar is still there or not', async () => {
  seedStored({ hiddenCalendars: [keyOf('/deleted/')] })
  renderScreen()
  await screen.findByRole('switch', { name: 'Work' })

  await userEvent.click(calendar('Work'))

  expect(getStored().hiddenCalendars).toEqual([keyOf('/deleted/'), keyOf('/work/')])
})

it('offers nothing to change while the calendars are not there, and says when they cannot be loaded', async () => {
  vi.mocked(getApi().listCalendars).mockRejectedValue(new TypeError('Failed to fetch'))
  renderScreen()

  await vi.waitFor(() => {
    expect(getApi().listCalendars).toHaveBeenCalled()
  })
  expect(button('Show all')).toBeDisabled()
  expect(button('Hide all')).toBeDisabled()
  expect(screen.queryByRole('switch')).not.toBeInTheDocument()
})

it('goes back', async () => {
  const onClose = renderScreen()

  await userEvent.click(button('Close'))

  expect(onClose).toHaveBeenCalledOnce()
})

it('is in the language of the app', async () => {
  await activateLocale('it')
  renderScreen()

  expect(await screen.findByRole('heading', { name: 'Calendari' })).toBeInTheDocument()
  expect(await screen.findByRole('heading', { name: 'Calendari' })).toBeInTheDocument()
  await waitFor(() => {
    expect(button('Mostra tutti')).toBeInTheDocument()
  })
  expect(button('Nascondi tutti')).toBeInTheDocument()
  expect(button('Chiudi')).toBeInTheDocument()
})

it('has the color of each calendar as the left border of its row', async () => {
  renderScreen()
  await screen.findByRole('switch', { name: 'Personal' })

  const colorOf = (name: string) =>
    screen.getByRole('button', { name }).closest<HTMLElement>('[data-slot="calendar-color"]')
  expect(colorOf('Personal')?.style.borderRightColor).toBe('rgb(37, 99, 235)')
  expect(colorOf('Work')?.style.borderRightColor).toBe('rgb(220, 38, 38)')
  expect(colorOf('Family')?.style.borderRightColor).toBe('rgb(22, 163, 74)')
  expect(colorOf('Work')).toHaveClass('border-r-4')
})

it('has a button to export, at the start of the row of Show all and Hide all', async () => {
  const screenCallbacks = renderScreen()
  const exportButton = await screen.findByRole('button', { name: 'Export' })

  // The same row as the buttons that show and hide the calendars, before them.
  const row = exportButton.closest('div')?.parentElement as HTMLElement
  expect(row).toContainElement(button('Show all'))
  expect(row).toContainElement(button('Hide all'))
  expect(
    exportButton.compareDocumentPosition(button('Show all')) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy()

  await userEvent.click(exportButton)

  expect(screenCallbacks.onExport).toHaveBeenCalledOnce()

  await userEvent.click(screen.getByRole('button', { name: 'Import' }))
  expect(screenCallbacks.onImport).toHaveBeenCalledOnce()
})
