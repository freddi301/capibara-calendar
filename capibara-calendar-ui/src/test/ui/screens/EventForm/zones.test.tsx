import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '@/App'
import { renderApp } from '@/test/render'
import { choose, openCreateScreen, setUpApp } from '@/test/support/app'

vi.mock('@/api/sources', async (original) => ({
  ...(await original<typeof import('@/api/sources')>()),
  checkCaldav: vi.fn(),
}))
vi.mock('@/api', async (original) => ({
  ...(await original<typeof import('@/api')>()),
  resetApi: vi.fn(),
}))

beforeEach(setUpApp) // the app is in Rome, and today is the 12th of November

afterEach(() => {
  vi.useRealTimers()
})

const startZone = () => screen.getByRole('combobox', { name: 'Time zone of the start' })
const endZone = () => screen.getByRole('combobox', { name: 'Time zone of the end' })
const type = (label: string, value: string) => {
  fireEvent.change(screen.getByLabelText(label), { target: { value } })
}

it('has a zone for the start and a zone for the end, in the zone of the app, even on a new event', async () => {
  // given
  renderApp(<App />)

  // when
  await openCreateScreen()

  // then
  expect(startZone()).toHaveTextContent('Rome')
  expect(endZone()).toHaveTextContent('Rome')
})

it('moves the end to the zone of the start, until the end has a zone of its own', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()

  // when
  await choose('Time zone of the start', /^UTC/)

  // then
  expect(startZone()).toHaveTextContent('UTC')
  expect(endZone()).toHaveTextContent('UTC')

  // when: the end has its own zone, and the start changes again
  await choose('Time zone of the end', 'New York')
  await choose('Time zone of the start', 'Tokyo')

  // then
  expect(startZone()).toHaveTextContent('Tokyo')
  expect(endZone()).toHaveTextContent('New York')
})

it('tells the time in the zone of the app under a row, with the day when it is another one', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()
  type('Start time', '15:00')
  type('End time', '16:00')
  expect(screen.queryByText(/ Rome$/)).not.toBeInTheDocument() // the same zone: nothing to tell

  // when
  await choose('Time zone of the start', /^UTC/)

  // then: 15:00 in UTC is 16:00 in Rome, and the end follows it
  expect(await screen.findByText('16:00 Rome')).toBeInTheDocument()
  expect(screen.getByText('17:00 Rome')).toBeInTheDocument()

  // when: 11:00 in Auckland is 23:00 in Rome, the evening before: that is another day
  type('Start time', '11:00')
  await choose('Time zone of the start', 'Auckland')

  // then
  expect(await screen.findByText(/23:00 Rome/)).toHaveTextContent('Wed, Nov 1123:00 Rome')
})

it('has the zone of the end of a floating event as floating, and grayed', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()

  // when
  await choose('Time zone of the start', /^Floating/)

  // then
  expect(endZone()).toHaveTextContent('Floating')
  expect(endZone()).toBeDisabled()
})

it('checks that the end is not before the start by the instants, when the zones are not the same', async () => {
  // given: in Rome, 10:30 is before 15:00
  renderApp(<App />)
  await openCreateScreen()
  type('Start time', '15:00')
  type('End time', '10:30')
  expect(await screen.findByText('The end cannot be before the start')).toBeInTheDocument()

  // when: 15:00 in Rome is 14:00 in UTC, and 10:30 in New York is 15:30 in UTC
  await choose('Time zone of the end', 'New York')

  // then
  expect(screen.queryByText('The end cannot be before the start')).not.toBeInTheDocument()

  // when: 08:00 in New York is 13:00 in UTC
  type('End time', '08:00')

  // then
  expect(await screen.findByText('The end cannot be before the start')).toBeInTheDocument()
})
