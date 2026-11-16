import { act, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { resetApi, setApi } from '@/api'
import App from '@/App'
import { clearConnectionOf, primaryConnectionId } from '@/lib/connection'
import { renderApp } from '@/test/render'
import { serveEvents } from '@/test/server'
import { calendars, dentist, setUpApp } from '@/test/support/app'
import { seedStored } from '@/test/support/stored'

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

it('shows the events of today, and the connection status', async () => {
  // when
  renderApp(<App />)

  // then
  expect(await screen.findByRole('button', { name: /Dentist/ })).toBeInTheDocument()
  expect(screen.getByText('Connected to the CalDAV server')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: /Thursday, November 12, 2026: 1 event/, pressed: true }),
  ).toBeInTheDocument()
})

it('opens the settings, to say which server, when there is none, with no way to go back', async () => {
  // given
  clearConnectionOf(primaryConnectionId)
  setApi(undefined)

  // when
  renderApp(<App />)

  // then
  expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  expect(screen.getByLabelText('Server address')).toHaveFocus()
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'New event' })).not.toBeInTheDocument()
})

it('opens the settings for any screen that was remembered, when there is no server', async () => {
  // given
  clearConnectionOf(primaryConnectionId)
  setApi(undefined)
  seedStored({ routeState: { route: { screen: 'filter' }, layout: 'agenda' } })

  // when
  renderApp(<App />)

  // then
  expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Calendars' })).not.toBeInTheDocument()
})

it('goes to the calendars when the first server is connected', async () => {
  // given
  clearConnectionOf(primaryConnectionId)
  setApi(undefined)
  renderApp(<App />)
  vi.mocked(resetApi).mockImplementation(() => {
    serveEvents([dentist], calendars) // the server that was just connected
  })

  // when
  await userEvent.type(await screen.findByLabelText('Server address'), '/radicale/')
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))

  // then
  expect(await screen.findByRole('group', { name: 'Week' })).toBeInTheDocument()
  expect(await screen.findByRole('button', { name: /Dentist/ })).toBeInTheDocument()
})

it('stays in the settings when another server is connected, and says so', async () => {
  // given
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Settings' }))
  await userEvent.click(screen.getByRole('button', { name: 'Change' }))

  // when
  await userEvent.type(screen.getByLabelText('Username'), '2')
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))

  // then
  expect(await screen.findByText('Connected to the CalDAV server')).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument()
})

it('goes back to asking for a server when it is disconnected', async () => {
  // given
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Settings' }))
  await userEvent.click(screen.getByRole('button', { name: 'Change' }))

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Disconnect' }))

  // then
  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
  expect(screen.getByLabelText('Server address')).toHaveValue('')
})

it('opens the calendars when there is a server', async () => {
  // when
  renderApp(<App />)

  // then
  expect(await screen.findByRole('group', { name: 'Week' })).toBeInTheDocument()
})

it('says that there is no network, and shows what was loaded last', async () => {
  // given
  renderApp(<App />)
  expect(await screen.findByText('Connected to the CalDAV server')).toBeInTheDocument()

  // when
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false)
  act(() => {
    window.dispatchEvent(new Event('offline'))
  })

  // then
  expect(await screen.findByText('No network. You see what was loaded last.')).toBeInTheDocument()
  expect(screen.queryByText('Connected to the CalDAV server')).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Dentist/ })).toBeInTheDocument() // what was loaded

  // when
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(true)
  act(() => {
    window.dispatchEvent(new Event('online'))
  })

  // then
  await waitFor(() => {
    expect(screen.queryByText('No network. You see what was loaded last.')).not.toBeInTheDocument()
  })
})
