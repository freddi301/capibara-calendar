import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { getApi } from '@/api'
import App from '@/App'
import { renderApp } from '@/test/render'
import { expectSaved, keyOf, saveCount } from '@/test/server'
import { choose, dentist, openCreateScreen, setUpApp } from '@/test/support/app'

vi.mock('@/api/sources', async (original) => ({
  ...(await original<typeof import('@/api/sources')>()),
  checkCaldav: vi.fn(),
}))
vi.mock('@/api', async (original) => ({
  ...(await original<typeof import('@/api')>()),
  resetApi: vi.fn(),
}))

beforeEach(setUpApp)

afterEach(() => {
  vi.useRealTimers()
})

it('opens the create screen from the bottom bar and goes back', async () => {
  // given
  renderApp(<App />)

  // when
  await openCreateScreen()

  // then
  expect(screen.getByRole('heading', { name: 'New event' })).toBeInTheDocument()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  // then
  expect(await screen.findByText('Dentist')).toBeInTheDocument()
  expect(saveCount()).toBe(0)
})

it('opens the list of the calendars, not the form, when no calendar can be written', async () => {
  // given
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

  // when
  await openCreateScreen()

  // then
  expect(await screen.findByRole('heading', { name: 'Calendars' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'New event' })).not.toBeInTheDocument()
})

it('creates an event and returns to the list', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()

  // when
  await userEvent.type(screen.getByLabelText('Title'), 'Lunch')
  await userEvent.type(screen.getByLabelText('Description'), 'With Sam')
  await choose('Calendar', 'Personal')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
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
  // given
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Dentist/ }))

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Edit' })) // it is only looked at, at first

  // then
  expect(screen.getByRole('heading', { name: 'Edit event' })).toBeInTheDocument()
  expect(screen.getByLabelText('Title')).toHaveValue('Dentist')
  expect(screen.getByLabelText('Description')).toHaveValue('Bring the forms')
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-12')
  expect(await screen.findByRole('combobox', { name: 'Calendar' })).toHaveTextContent('Personal')

  // when
  await userEvent.type(screen.getByLabelText('Title'), ' checkup')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  expectSaved(
    expect.objectContaining({ title: 'Dentist checkup' }),
    dentist,
    undefined, // the event does not repeat: no choice of which
  )
})

it('starts a new event without a calendar, and does not save until one is chosen', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()
  const picker = await screen.findByRole('combobox', { name: 'Calendar' })
  await userEvent.type(screen.getByLabelText('Title'), 'Lunch')

  // then
  expect(picker).toHaveTextContent('Calendar') // only the placeholder: no calendar was picked for the user

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  expect(await screen.findByText('Choose a calendar')).toBeInTheDocument()
  expect(saveCount()).toBe(0)

  // when
  await choose('Calendar', 'Personal')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  expectSaved(expect.objectContaining({ calendarUrl: keyOf('/personal/') }), undefined, undefined)
})

it('writes the event to the calendar that was chosen', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()

  // when
  await userEvent.type(screen.getByLabelText('Title'), 'Lunch')
  await userEvent.click(screen.getByRole('combobox', { name: 'Calendar' }))
  await userEvent.click(await screen.findByRole('option', { name: 'Work' }))
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  expectSaved(expect.objectContaining({ calendarUrl: keyOf('/work/') }), undefined, undefined)
})

it('starts the title with one row and keeps it on one line', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()
  const title = screen.getByLabelText('Title')
  expect(title).toHaveAttribute('rows', '1')

  // when
  await userEvent.type(title, 'Lunch{Enter}with Sam')

  // then
  expect(title).toHaveValue('Lunchwith Sam') // Enter did not add a line break
  expect(saveCount()).toBe(0) // and it did not save either
})

it('starts a new event on the day that is selected, and an edited event on its own day', async () => {
  // given
  renderApp(<App />)
  await screen.findByRole('button', { name: /Dentist/ })

  // when
  await userEvent.click(screen.getByRole('button', { name: /Saturday, November 14/ }))
  await userEvent.click(screen.getByRole('button', { name: 'New event' }))

  // then
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-14')

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))
  await userEvent.click(screen.getByRole('button', { name: /Thursday, November 12/ }))
  await userEvent.click(await screen.findByRole('button', { name: /Dentist/ }))
  await screen.findByRole('heading', { name: 'Dentist' })

  // then
  expect(document.body).toHaveTextContent('November 12') // the day of the event
})
