import { checkCaldav } from '../api/sources'
import { resetApi } from '../api'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { activateLocale } from '../i18n'
import { clearConnection, loadConnection, saveConnection } from '../lib/connection'
import SettingsScreen from '../screens/SettingsScreen'
import { renderApp } from './render'

vi.mock('../api/sources', async (original) => ({
  ...(await original<typeof import('../api/sources')>()),
  checkCaldav: vi.fn(),
}))
vi.mock('../api', async (original) => ({
  ...(await original<typeof import('../api')>()),
  resetApi: vi.fn(),
}))

beforeEach(() => {
  saveConnection({ url: 'https://caldav.example/dav/', username: 'user', password: 'secret' })
  vi.mocked(checkCaldav).mockResolvedValue()
})

function renderScreen({ withBack = true } = {}) {
  const onClose = vi.fn()
  const onConnectionChange = vi.fn()
  renderApp(
    <SettingsScreen
      onClose={withBack ? onClose : undefined}
      onConnectionChange={onConnectionChange}
    />,
  )
  return { onClose, onConnectionChange }
}

const address = () => screen.getByLabelText('Server address')
const username = () => screen.getByLabelText('Username')
const password = () => screen.getByLabelText('Password')
const button = (name: string) => screen.getByRole('button', { name })

async function fill(url: string, user = '', secret = '') {
  await userEvent.clear(address())
  if (url) await userEvent.type(address(), url)
  await userEvent.clear(username())
  if (user) await userEvent.type(username(), user)
  await userEvent.clear(password())
  if (secret) await userEvent.type(password(), secret)
}

it('has the connection under the sources, with what was saved', () => {
  renderScreen({ withBack: false })

  const headings = screen.getAllByText(/^(Settings|Sources)$/)
  expect(headings.map((heading) => heading.textContent)).toEqual(['Settings', 'Sources'])
  expect(address()).toHaveValue('https://caldav.example/dav/')
  expect(username()).toHaveValue('user')
  expect(password()).toHaveValue('secret')
  expect(password()).toHaveAttribute('type', 'password')
})

it('has empty fields, and the address to type in, when there is no server', async () => {
  clearConnection()
  renderScreen()

  expect(address()).toHaveValue('')
  await waitFor(() => {
    expect(address()).toHaveFocus()
  })
  expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument()
})

it('does not take the focus when there is a server already', () => {
  renderScreen()

  expect(address()).not.toHaveFocus()
})

it('tries the server, and keeps it when it works', async () => {
  clearConnection()
  const { onConnectionChange } = renderScreen()

  await fill('https://drive.example.org/remote.php/dav', 'ada', 'app password')
  await userEvent.click(button('Connect'))

  expect(await screen.findByText('Connected to the CalDAV server')).toBeInTheDocument()
  expect(checkCaldav).toHaveBeenCalledExactlyOnceWith(
    {
      url: 'https://drive.example.org/remote.php/dav',
      username: 'ada',
      password: 'app password',
    },
    'caldav',
  )
  expect(loadConnection()).toEqual({
    url: 'https://drive.example.org/remote.php/dav',
    username: 'ada',
    password: 'app password',
  })
  expect(resetApi).toHaveBeenCalledOnce() // the next request is to the new server
  expect(onConnectionChange).toHaveBeenCalledExactlyOnceWith(true)
  expect(button('Disconnect')).toBeInTheDocument()
})

it('keeps the server that was saved when the new one does not work', async () => {
  vi.mocked(checkCaldav).mockRejectedValue(
    new Error('Invalid credentials: PROPFIND https://x/dav returned 401'),
  )
  const { onConnectionChange } = renderScreen()

  await fill('https://other.example.org/dav', 'ada', 'wrong')
  await userEvent.click(button('Connect'))

  expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password.')
  expect(loadConnection()?.url).toBe('https://caldav.example/dav/')
  expect(onConnectionChange).not.toHaveBeenCalled()
  expect(screen.queryByText('Connected to the CalDAV server')).not.toBeInTheDocument()
  expect(address()).toHaveValue('https://other.example.org/dav') // what was typed stays
})

it('says what is wrong when the address is not one of a CalDAV server, or is not reached', async () => {
  renderScreen()

  vi.mocked(checkCaldav).mockRejectedValueOnce(new Error('cannot find principalUrl'))
  await userEvent.click(button('Connect'))
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This does not look like the address of a CalDAV server.',
  )

  vi.mocked(checkCaldav).mockRejectedValueOnce(new TypeError('Failed to fetch'))
  await userEvent.click(button('Connect'))
  await waitFor(() => {
    expect(screen.getByRole('alert')).toHaveTextContent('Cannot reach the CalDAV server')
  })
})

it('does not try a server without an address, or with one that is not an address', async () => {
  clearConnection()
  renderScreen()

  await userEvent.click(button('Connect'))
  expect(await screen.findByText('Enter the address of the server')).toBeInTheDocument()

  await fill('ftp://files.example.org')
  await userEvent.click(button('Connect'))
  expect(await screen.findByText('Enter a valid address')).toBeInTheDocument()
  expect(checkCaldav).not.toHaveBeenCalled()
  expect(loadConnection()).toBeUndefined()
})

it('accepts an address on this site, which goes to a server on another domain', async () => {
  clearConnection()
  renderScreen()

  await fill('/remote.php/dav', 'ada', 'x')
  await userEvent.click(button('Connect'))

  await screen.findByText('Connected to the CalDAV server')
  expect(loadConnection()?.url).toBe('/remote.php/dav')
})

it('shows that it is trying, and does not try twice', async () => {
  let finish = () => {}
  vi.mocked(checkCaldav).mockReturnValue(
    new Promise<void>((resolve) => {
      finish = resolve
    }),
  )
  renderScreen()

  await userEvent.click(button('Connect'))

  expect(button('Connect')).toBeDisabled()
  expect(button('Disconnect')).toBeDisabled()
  finish()
  await waitFor(() => {
    expect(button('Connect')).toBeEnabled()
  })
  expect(checkCaldav).toHaveBeenCalledOnce()
})

it('forgets the server when it is disconnected, and empties the fields', async () => {
  const { onConnectionChange } = renderScreen()

  await userEvent.click(button('Disconnect'))

  expect(loadConnection()).toBeUndefined()
  expect(resetApi).toHaveBeenCalledOnce()
  expect(onConnectionChange).toHaveBeenCalledExactlyOnceWith(false)
  expect(address()).toHaveValue('')
  expect(password()).toHaveValue('')
  expect(screen.queryByRole('button', { name: 'Disconnect' })).not.toBeInTheDocument()
})

it('has a way back only when there is a server to go back to', async () => {
  const { onClose } = renderScreen()
  await userEvent.click(button('Back'))
  expect(onClose).toHaveBeenCalledOnce()
})

it('has no way back without it', () => {
  renderScreen({ withBack: false })

  expect(screen.queryByRole('button', { name: 'Back' })).not.toBeInTheDocument()
})

it('is in the language of the app', async () => {
  await activateLocale('it')
  renderScreen()

  expect(screen.getByText('Sorgenti')).toBeInTheDocument()
  expect(screen.getByLabelText('Indirizzo del server')).toBeInTheDocument()
  expect(screen.getByLabelText('Nome utente')).toBeInTheDocument()
  expect(screen.getByLabelText('Password')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Connetti' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Disconnetti' })).toBeInTheDocument()
})
