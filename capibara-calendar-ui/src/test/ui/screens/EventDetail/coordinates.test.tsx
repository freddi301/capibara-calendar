import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '@/App'
import { renderApp } from '@/test/render'
import { serveEvents } from '@/test/server'
import { calendars, dentist, setUpApp } from '@/test/support/app'

vi.mock('@/api/sources', async (original) => ({
  ...(await original<typeof import('@/api/sources')>()),
  checkCaldav: vi.fn(),
}))
vi.mock('@/api', async (original) => ({
  ...(await original<typeof import('@/api')>()),
  resetApi: vi.fn(),
}))

beforeEach(() => {
  setUpApp()
  serveEvents(
    [
      { ...dentist, uid: '1', title: 'Lunch', location: 'Villa', coordinates: '44.38, 9.04' },
      { ...dentist, uid: '2', title: 'Meeting', location: 'Room 4' },
      { ...dentist, uid: '3', title: 'Hike', coordinates: '46.5, 8.1' },
      { ...dentist, uid: '4', title: 'Call' },
    ],
    calendars,
  )
})

afterEach(() => {
  vi.useRealTimers()
})

async function openEvent(title: RegExp) {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: title }))
}

it('links the coordinates of the event to the maps app of the device', async () => {
  // given
  await openEvent(/Lunch/)

  // then
  expect(screen.getByText('Villa')).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Open the coordinates in the maps app' }),
  ).toHaveAttribute('href', 'geo:44.38,9.04')
})

it('has the button grayed when the place has no coordinates', async () => {
  // given
  await openEvent(/Meeting/)

  // then
  expect(screen.getByText('Room 4')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'No coordinates' })).toBeDisabled()
  expect(screen.queryByRole('link', { name: /coordinates/ })).not.toBeInTheDocument()
})

it('says the coordinates in place of the name when there is no name', async () => {
  // given
  await openEvent(/Hike/)

  // then
  expect(screen.getByText('46.5, 8.1')).toBeInTheDocument()
  expect(
    screen.getByRole('link', { name: 'Open the coordinates in the maps app' }),
  ).toHaveAttribute('href', 'geo:46.5,8.1')
})

it('has no place row when the event has no place', async () => {
  // given
  await openEvent(/Call/)

  // then
  expect(screen.getByRole('heading', { name: 'Call' })).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'No coordinates' })).not.toBeInTheDocument()
  expect(screen.queryByRole('link', { name: /coordinates/ })).not.toBeInTheDocument()
})
