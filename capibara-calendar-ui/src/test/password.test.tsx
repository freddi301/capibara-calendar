import { serveEvents } from './server'
import { getApi, setApi } from '../api'
import { screen, waitFor } from '@testing-library/react'
import { beforeEach, expect, it, vi } from 'vitest'
import App from '../App'
import {
  forgetPasswordOf,
  loadAddressOf,
  loadConnectionOf,
  primaryConnectionId,
  saveConnectionOf,
} from '../lib/connection'
import { createQueryClient } from '../lib/query-client'
import { renderApp } from './render'

beforeEach(() => {
  saveConnectionOf(primaryConnectionId, {
    url: 'https://caldav.example/dav/',
    username: 'user',
    password: 'secret',
  })
  serveEvents([], [{ url: '/c/', name: 'Personal', color: '' }])
  vi.mocked(getApi().listEvents).mockResolvedValue([])
  vi.mocked(getApi().revision).mockResolvedValue(undefined) // the events are asked for every time
})

it('asks for the password again, with the address and the user, when it is not kept', async () => {
  forgetPasswordOf(primaryConnectionId) // the password was not kept
  setApi(undefined) // and the servers are not connected any more

  renderApp(<App />)

  expect(await screen.findByText('Enter your password to connect again.')).toBeInTheDocument()
  expect(screen.getByLabelText('Server address')).toHaveValue('https://caldav.example/dav/')
  expect(screen.getByLabelText('Username')).toHaveValue('user')
  expect(screen.getByLabelText('Password')).toHaveValue('')
  expect(screen.getByLabelText('Password')).toHaveFocus()
})

it('goes back to the connection when the server does not accept the password, and forgets it', async () => {
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } })
  renderApp(<App />, client)
  await screen.findByText('Connected to the CalDAV server')

  vi.mocked(getApi().listEvents).mockRejectedValue(
    new Error('Invalid credentials: PROPFIND https://caldav.example/dav/ returned 401'),
  )
  await client.invalidateQueries({ queryKey: ['events'] })

  expect(
    await screen.findByText('The server did not accept the password. Enter it again.'),
  ).toBeInTheDocument()
  await waitFor(() => {
    expect(screen.getByLabelText('Password')).toHaveFocus()
  })
  expect(screen.getByLabelText('Server address')).toHaveValue('https://caldav.example/dav/')
  expect(loadConnectionOf(primaryConnectionId)).toBeUndefined()
  expect(loadAddressOf(primaryConnectionId)?.username).toBe('user') // only the password is gone
})

it('does not end the connection for a problem that is not the password', async () => {
  const client = createQueryClient()
  client.setDefaultOptions({ queries: { ...client.getDefaultOptions().queries, retry: false } })
  renderApp(<App />, client)
  await screen.findByText('Connected to the CalDAV server')

  vi.mocked(getApi().listEvents).mockRejectedValue(
    new Error('Collection query failed: 503 Unavailable.'),
  )
  await client.invalidateQueries({ queryKey: ['events'] })

  await vi.waitFor(() => {
    expect(getApi().listEvents).toHaveBeenCalled()
  })
  expect(loadConnectionOf(primaryConnectionId)).toBeDefined()
})
