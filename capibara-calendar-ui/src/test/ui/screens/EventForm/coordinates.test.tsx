import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '@/App'
import { renderApp } from '@/test/render'
import { expectSaved, saveCount, serveEvents } from '@/test/server'
import { calendars, dentist, openCreateScreen, setUpApp } from '@/test/support/app'

vi.mock('@/api/sources', async (original) => ({
  ...(await original<typeof import('@/api/sources')>()),
  checkCaldav: vi.fn(),
}))
vi.mock('@/api', async (original) => ({
  ...(await original<typeof import('@/api')>()),
  resetApi: vi.fn(),
}))

const lunch = { ...dentist, title: 'Lunch', location: 'Villa', coordinates: '44.38, 9.04' }

beforeEach(() => {
  setUpApp()
  serveEvents([lunch], calendars)
})

afterEach(() => {
  vi.useRealTimers()
})

async function openForEdit() {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Lunch/ }))
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
}

async function typeCoordinates(text: string) {
  await userEvent.click(screen.getByRole('button', { name: 'Coordinates' }))
  await changeCoordinates(text)
}

async function changeCoordinates(text: string) {
  const field = await screen.findByRole('textbox', { name: 'Coordinates' })
  await userEvent.clear(field)
  if (text) await userEvent.type(field, text)
  await userEvent.keyboard('{Enter}') // closes the field, does not save the form
}

it('saves the coordinates that were typed, for a new event', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()
  await userEvent.type(screen.getByLabelText('Title'), 'Hike')

  // when
  await typeCoordinates('46.5 8.1')
  expect(saveCount()).toBe(0)
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  expectSaved(expect.objectContaining({ title: 'Hike', coordinates: '46.5, 8.1' }))
})

it('shows the coordinates of the event in the field, and saves the ones that were changed', async () => {
  // given
  await openForEdit()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Coordinates' }))

  // then
  expect(await screen.findByRole('textbox', { name: 'Coordinates' })).toHaveValue('44.38, 9.04')

  // when
  await changeCoordinates('45.46, 9.19')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  expectSaved(expect.objectContaining({ location: 'Villa', coordinates: '45.46, 9.19' }), lunch)
})

it('keeps the coordinates when only the name of the place is changed', async () => {
  // given
  await openForEdit()

  // when
  await userEvent.type(screen.getByLabelText('Location'), ' Groppallo')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  expectSaved(
    expect.objectContaining({ location: 'Villa Groppallo', coordinates: '44.38, 9.04' }),
    lunch,
  )
})

it('takes the coordinates away when the field is emptied', async () => {
  // given
  await openForEdit()

  // when
  await typeCoordinates('')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  expectSaved(expect.objectContaining({ location: 'Villa', coordinates: '' }), lunch)
})

it('says what is wrong with coordinates that are not two numbers, and does not save', async () => {
  // given
  await openForEdit()

  // when
  await typeCoordinates('abc')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  expect(
    await screen.findByText('Enter the latitude and the longitude, like 44.38, 9.04'),
  ).toBeInTheDocument()
  expect(saveCount()).toBe(0)

  // when
  await typeCoordinates('91, 0')

  // then: a place that is not on Earth is not taken either
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  expect(
    await screen.findByText('Enter the latitude and the longitude, like 44.38, 9.04'),
  ).toBeInTheDocument()
  expect(saveCount()).toBe(0)
})
