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

const timed = (uid: string, title: string, times: object) => ({
  ...dentist,
  uid,
  title,
  startDate: '2026-11-12',
  ...times,
})

beforeEach(() => {
  setUpApp() // the app is in Rome
  serveEvents(
    [
      timed('1', 'Dinner', { startTime: '10:00', endTime: '11:00', timeZone: 'Europe/Rome' }),
      timed('2', 'Call', {
        startTime: '09:00',
        endTime: '10:30',
        timeZone: 'UTC',
        endTimeZone: 'UTC',
      }),
      timed('3', 'Flight', {
        startTime: '15:00',
        endTime: '15:30',
        timeZone: 'UTC',
        endTimeZone: 'America/New_York',
      }),
      timed('4', 'Meeting', {
        startTime: '10:00',
        endTime: '12:30',
        timeZone: 'Europe/Rome',
        endTimeZone: 'America/New_York',
      }),
      timed('5', 'Long haul', {
        startTime: '22:00',
        endDate: '2026-11-12',
        endTime: '16:00',
        timeZone: 'Asia/Tokyo',
        endTimeZone: 'America/Los_Angeles',
      }),
      timed('6', 'Walk', { startTime: '09:00', endTime: '10:00', timeZone: '' }),
    ],
    calendars,
  )
})

afterEach(() => {
  vi.useRealTimers()
})

async function openEvent(title: string) {
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: new RegExp(title) }))
  await screen.findByRole('heading', { name: 'Event' })
}

it('shows no other time when the event is in the zone of the app, or floating', async () => {
  // given
  await openEvent('Dinner')

  // then
  expect(screen.getByRole('heading', { name: 'Dinner' })).toBeInTheDocument()
  expect(screen.queryByText('Rome')).not.toBeInTheDocument()
  expect(screen.queryByText('UTC')).not.toBeInTheDocument()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))
  await userEvent.click(await screen.findByRole('button', { name: /Walk/ }))

  // then
  expect(await screen.findByRole('heading', { name: 'Walk' })).toBeInTheDocument()
  expect(screen.queryByText('Rome')).not.toBeInTheDocument()
  expect(screen.queryByText('UTC')).not.toBeInTheDocument()
})

it('shows the time in its own zone and the name of the zone under the time of the app, when the whole event is in another zone', async () => {
  // given
  await openEvent('Call')

  // then: 09:00 in UTC is 10:00 in Rome
  expect(screen.getByText('UTC').parentElement).toHaveTextContent('09:00–10:30UTC')
})

it('shows each side under its own place, with the name of its zone, when the start and the end are in two zones', async () => {
  // given
  await openEvent('Flight')

  // then
  expect(screen.getByText('UTC').parentElement).toHaveTextContent('15:00–15:30UTCNew York')
})

it('shows only the side that is not in the zone of the app', async () => {
  // given
  await openEvent('Meeting')

  // then
  expect(screen.queryByText('Rome')).not.toBeInTheDocument()
  expect(screen.getByText('New York').parentElement).toHaveTextContent('12:30New York')
})

it('tells the day of a side only when it is not the day that is shown', async () => {
  // given
  await openEvent('Long haul')

  // then: the start is on the day that is shown, the end is on the day before in Los Angeles
  expect(screen.getByText('Tokyo').parentElement).toHaveTextContent('22:00Tokyo')
  expect(screen.getByText('Los Angeles').parentElement).toHaveTextContent(
    'Thu, Nov 1216:00Los Angeles',
  )
})
