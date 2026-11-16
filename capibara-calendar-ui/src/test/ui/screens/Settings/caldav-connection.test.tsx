import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { resetApi } from '@/api'
import { checkCaldav } from '@/api/sources'
import { activateLocale } from '@/i18n'
import {
  clearConnectionOf,
  loadConnectionOf,
  primaryConnectionId,
  saveConnectionOf,
} from '@/lib/connection'
import SettingsScreen from '@/screens/SettingsScreen'
import { renderApp } from '@/test/render'

vi.mock('@/api/sources', async (original) => ({
  ...(await original<typeof import('@/api/sources')>()),
  checkCaldav: vi.fn(),
}))
vi.mock('@/api', async (original) => ({
  ...(await original<typeof import('@/api')>()),
  resetApi: vi.fn(),
}))

beforeEach(() => {
  saveConnectionOf(primaryConnectionId, {
    url: 'https://caldav.example/dav/',
    username: 'user',
    password: 'secret',
  })
  vi.mocked(checkCaldav).mockResolvedValue()
})

function renderScreen() {
  const onConnectionChange = vi.fn()
  renderApp(<SettingsScreen onClose={vi.fn()} onConnectionChange={onConnectionChange} />)
  return { onConnectionChange }
}

const address = () => screen.getByLabelText('Server address')
const username = () => screen.getByLabelText('Username')
const password = () => screen.getByLabelText('Password')
const button = (name: string) => screen.getByRole('button', { name })

/** A connection that is saved shows only what it is: its fields are there after "Change". */
const change = () => userEvent.click(button('Change'))

async function fill(url: string, user = '', secret = '') {
  await userEvent.clear(address())
  if (url) await userEvent.type(address(), url)
  await userEvent.clear(username())
  if (user) await userEvent.type(username(), user)
  await userEvent.clear(password())
  if (secret) await userEvent.type(password(), secret)
}

it('shows the connection that was saved by its server and user, without the fields', () => {
  // given
  renderScreen()

  // then
  expect(screen.getByText('caldav.example')).toBeInTheDocument()
  expect(screen.getByText('user')).toBeInTheDocument()
  expect(screen.queryByLabelText('Server address')).not.toBeInTheDocument()
  expect(screen.queryByLabelText('Password')).not.toBeInTheDocument()
  expect(button('Change')).toBeInTheDocument()
})

it('shows what was saved in the fields, with the password hidden, when it is changed', async () => {
  // given
  renderScreen()

  // when
  await change()

  // then
  expect(address()).toHaveValue('https://caldav.example/dav/')
  expect(username()).toHaveValue('user')
  expect(password()).toHaveValue('secret')
  expect(password()).toHaveAttribute('type', 'password')
  expect(address()).not.toHaveFocus()
})

it('closes the fields without saving, when the change is cancelled', async () => {
  // given
  renderScreen()
  await change()
  await userEvent.type(username(), '2')

  // when
  await userEvent.click(button('Cancel'))

  // then
  expect(screen.queryByLabelText('Server address')).not.toBeInTheDocument()
  expect(loadConnectionOf(primaryConnectionId)?.username).toBe('user')
})

it('has empty fields, and the address to type in, when there is no server', async () => {
  // given
  clearConnectionOf(primaryConnectionId)

  // when
  renderScreen()

  // then
  expect(address()).toHaveValue('')
  await waitFor(() => {
    expect(address()).toHaveFocus()
  })
  expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Change' })).not.toBeInTheDocument()
})

it('tries the server, and keeps it when it works', async () => {
  // given
  clearConnectionOf(primaryConnectionId)
  const { onConnectionChange } = renderScreen()

  // when
  await fill('https://drive.example.org/remote.php/dav', 'ada', 'app password')
  await userEvent.click(button('Connect'))

  // then
  expect(await screen.findByText('Connected to the CalDAV server')).toBeInTheDocument()
  expect(checkCaldav).toHaveBeenCalledExactlyOnceWith(
    {
      url: 'https://drive.example.org/remote.php/dav',
      username: 'ada',
      password: 'app password',
    },
    'caldav',
  )
  expect(loadConnectionOf(primaryConnectionId)).toEqual({
    url: 'https://drive.example.org/remote.php/dav',
    username: 'ada',
    password: 'app password',
  })
  expect(resetApi).toHaveBeenCalledOnce() // the next request is to the new server
  expect(onConnectionChange).toHaveBeenCalledExactlyOnceWith(true)
  expect(screen.getByText('drive.example.org')).toBeInTheDocument()
  expect(button('Change')).toBeInTheDocument()
})

it('keeps the server that was saved when the new one does not work', async () => {
  // given
  vi.mocked(checkCaldav).mockRejectedValue(
    new Error('Invalid credentials: PROPFIND https://x/dav returned 401'),
  )
  const { onConnectionChange } = renderScreen()
  await change()

  // when
  await fill('https://other.example.org/dav', 'ada', 'wrong')
  await userEvent.click(button('Connect'))

  // then
  expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password.')
  expect(loadConnectionOf(primaryConnectionId)?.url).toBe('https://caldav.example/dav/')
  expect(onConnectionChange).not.toHaveBeenCalled()
  expect(screen.queryByText('Connected to the CalDAV server')).not.toBeInTheDocument()
  expect(address()).toHaveValue('https://other.example.org/dav') // what was typed stays
})

it('says what is wrong when the address is not one of a CalDAV server, or is not reached', async () => {
  // given
  renderScreen()
  await change()

  // when
  vi.mocked(checkCaldav).mockRejectedValueOnce(new Error('cannot find principalUrl'))
  await userEvent.click(button('Connect'))

  // then
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This does not look like the address of a CalDAV server.',
  )

  // when
  vi.mocked(checkCaldav).mockRejectedValueOnce(new TypeError('Failed to fetch'))
  await userEvent.click(button('Connect'))

  // then
  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach the CalDAV server')
  })
})

it('does not try a server without an address, or with one that is not an address', async () => {
  // given
  clearConnectionOf(primaryConnectionId)
  renderScreen()

  // when
  await userEvent.click(button('Connect'))

  // then
  expect(await screen.findByText('Enter the address of the server')).toBeInTheDocument()

  // when
  await fill('ftp://files.example.org')
  await userEvent.click(button('Connect'))

  // then
  expect(await screen.findByText('Enter a valid address')).toBeInTheDocument()
  expect(checkCaldav).not.toHaveBeenCalled()
  expect(loadConnectionOf(primaryConnectionId)).toBeUndefined()
})

it('accepts an address on this site, which goes to a server on another domain', async () => {
  // given
  clearConnectionOf(primaryConnectionId)
  renderScreen()

  // when
  await fill('/remote.php/dav', 'ada', 'x')
  await userEvent.click(button('Connect'))

  // then
  await screen.findByText('Connected to the CalDAV server')
  expect(loadConnectionOf(primaryConnectionId)?.url).toBe('/remote.php/dav')
})

it('shows that it is trying, and does not try twice', async () => {
  // given
  let finish = () => {}
  vi.mocked(checkCaldav).mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve
    }),
  )
  renderScreen()
  await change()

  // when
  await userEvent.click(button('Connect'))

  // then
  expect(button('Connect')).toBeDisabled()
  expect(button('Disconnect')).toBeDisabled()
  finish()
  await waitFor(() => {
    expect(screen.queryByRole('button', { name: 'Connect' })).not.toBeInTheDocument()
  })
  expect(checkCaldav).toHaveBeenCalledOnce()
})

it('forgets the server when it is disconnected, and empties the fields', async () => {
  // given
  const { onConnectionChange } = renderScreen()
  await change()

  // when
  await userEvent.click(button('Disconnect'))

  // then
  expect(loadConnectionOf(primaryConnectionId)).toBeUndefined()
  expect(resetApi).toHaveBeenCalledOnce()
  expect(onConnectionChange).toHaveBeenCalledExactlyOnceWith(false)
  expect(address()).toHaveValue('')
  expect(password()).toHaveValue('')
  expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument()
})

it('is in the language of the app', async () => {
  // given
  await activateLocale('it')
  renderScreen()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Cambia' }))

  // then
  expect(screen.getByText('Sorgenti')).toBeInTheDocument()
  expect(screen.getByLabelText('Indirizzo del server')).toBeInTheDocument()
  expect(screen.getByLabelText('Nome utente')).toBeInTheDocument()
  expect(screen.getByLabelText('Password')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Connetti' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Disconnetti' })).toBeInTheDocument()
})
