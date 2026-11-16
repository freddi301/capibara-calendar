import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { resetApi } from '@/api'
import { ApiError } from '@/api/calendar-api'
import { checkWebcal } from '@/api/sources'
import SettingsScreen from '@/screens/SettingsScreen'
import { renderApp } from '@/test/render'
import { seedStored, storedJson } from '@/test/support/stored'

vi.mock('@/api/sources', async (original) => ({
  ...(await original<typeof import('@/api/sources')>()),
  checkWebcal: vi.fn(),
}))
vi.mock('@/api', async (original) => ({
  ...(await original<typeof import('@/api')>()),
  resetApi: vi.fn(),
}))

const feed = 'https://feeds.example/holidays.ics'

beforeEach(() => {
  vi.mocked(checkWebcal).mockResolvedValue({ name: 'Holidays', color: undefined })
})

function renderScreen() {
  const onConnectionChange = vi.fn()
  renderApp(<SettingsScreen onClose={vi.fn()} onConnectionChange={onConnectionChange} />)
  return { onConnectionChange }
}

const address = () => screen.getByLabelText('Webcal address')
const button = (name: string) => screen.getByRole('button', { name })

async function add(url: string, name = '') {
  await userEvent.click(button('Add Webcal'))
  if (url) await userEvent.type(address(), url)
  if (name) await userEvent.type(screen.getByLabelText('Name (optional)'), name)
  await userEvent.click(button('Add'))
}

it('adds a webcal as a card of its own, named by the feed', async () => {
  // given
  const { onConnectionChange } = renderScreen()

  // when
  await add(feed)

  // then
  expect(await screen.findByText('Holidays')).toBeInTheDocument()
  expect(screen.getByText('feeds.example/holidays.ics')).toBeInTheDocument()
  expect(checkWebcal).toHaveBeenCalledExactlyOnceWith(feed)
  expect(Object.values(storedJson().webcals as object)).toEqual([{ url: feed, name: 'Holidays' }])
  expect(resetApi).toHaveBeenCalledOnce() // the next request is to the sources that are kept
  expect(onConnectionChange).toHaveBeenCalledOnce()
  expect(screen.queryByLabelText('Webcal address')).not.toBeInTheDocument() // the form is closed
  expect(button('Add Webcal')).toBeInTheDocument()
})

it('keeps the color that the feed says', async () => {
  // given
  vi.mocked(checkWebcal).mockResolvedValue({ name: 'Holidays', color: '#2563eb' })
  renderScreen()

  // when
  await add(feed)

  // then
  await screen.findByText('Holidays')
  expect(Object.values(storedJson().webcals as object)).toEqual([
    { url: feed, name: 'Holidays', color: '#2563eb' },
  ])
})

it('names it by its address, without the protocol, when nobody named it', async () => {
  // given
  vi.mocked(checkWebcal).mockResolvedValue({ name: undefined, color: undefined })
  renderScreen()

  // when
  await userEvent.click(button('Add Webcal'))
  await userEvent.type(address(), 'webcal://feeds.example/holidays.ics')

  // then: it is what the name field says, before it is added
  expect(screen.getByLabelText('Name (optional)')).toHaveAttribute(
    'placeholder',
    'feeds.example/holidays.ics',
  )

  // when
  await userEvent.click(button('Add'))

  // then
  expect(await screen.findAllByText('feeds.example/holidays.ics')).toHaveLength(2) // the title and the calendar
  expect(Object.values(storedJson().webcals as object)).toEqual([
    { url: feed, name: 'feeds.example/holidays.ics' },
  ])
})

it('keeps the name that was typed, over the one of the feed', async () => {
  // given
  renderScreen()

  // when
  await add(feed, 'Parties')

  // then
  expect(await screen.findByText('Parties')).toBeInTheDocument()
  expect(screen.queryByText('Holidays')).not.toBeInTheDocument()
})

it('does not add the same webcal twice, written another way', async () => {
  // given
  renderScreen()
  await add(feed)
  await screen.findByText('Holidays')

  // when
  await add('webcal://feeds.example/holidays.ics')

  // then
  expect(await screen.findByText('This Webcal is already added')).toBeInTheDocument()
  expect(checkWebcal).toHaveBeenCalledOnce()
  expect(Object.keys(storedJson().webcals as object)).toHaveLength(1)
})

it('does not try without an address, or with one that is not an address', async () => {
  // given
  renderScreen()

  // when
  await add('')

  // then
  expect(await screen.findByText('Enter the address of the Webcal')).toBeInTheDocument()

  // when
  await userEvent.type(address(), 'ftp://feeds.example/a.ics')
  await userEvent.click(button('Add'))

  // then
  expect(await screen.findByText('Enter a valid address')).toBeInTheDocument()
  expect(checkWebcal).not.toHaveBeenCalled()
  expect(storedJson().webcals ?? {}).toEqual({})
})

it('says what is wrong when the feed cannot be added, and keeps what was typed', async () => {
  // given
  renderScreen()
  await userEvent.click(button('Add Webcal'))
  await userEvent.type(address(), feed)

  // when
  vi.mocked(checkWebcal).mockRejectedValueOnce(new Error('Not a calendar file'))
  await userEvent.click(button('Add'))

  // then
  expect(await screen.findByRole('alert')).toHaveTextContent('This is not a calendar file.')

  // when
  vi.mocked(checkWebcal).mockRejectedValueOnce(new TypeError('Failed to fetch'))
  await userEvent.click(button('Add'))

  // then
  expect(await screen.findByText('Cannot reach this address')).toBeInTheDocument()

  // when
  vi.mocked(checkWebcal).mockRejectedValueOnce(new ApiError('forbidden'))
  await userEvent.click(button('Add'))

  // then
  expect(await screen.findByText('This address cannot be added from here.')).toBeInTheDocument()
  expect(address()).toHaveValue(feed)
  expect(storedJson().webcals ?? {}).toEqual({})
})

it('closes the form without adding, when it is cancelled', async () => {
  // given
  renderScreen()
  await userEvent.click(button('Add Webcal'))
  await userEvent.type(address(), feed)

  // when
  await userEvent.click(button('Cancel'))

  // then
  expect(screen.queryByLabelText('Webcal address')).not.toBeInTheDocument()
  expect(checkWebcal).not.toHaveBeenCalled()
})

it('removes a webcal with the button of its card', async () => {
  // given
  seedStored({ webcals: { feed1: { url: feed, name: 'Holidays' } } })
  renderScreen()
  expect(screen.getByText('Holidays')).toBeInTheDocument()

  // when
  await userEvent.click(button('Remove Holidays'))

  // then
  expect(screen.queryByText('Holidays')).not.toBeInTheDocument()
  expect(storedJson().webcals).toEqual({})
  expect(resetApi).toHaveBeenCalledOnce()
})

it('shows the webcals between the CalDAV connections and the sources on this device, each with its add button', () => {
  // given
  seedStored({ webcals: { feed1: { url: feed, name: 'Holidays' } } })

  // when
  renderScreen()

  // then
  const order = screen
    .getAllByRole('button')
    .map((one) => one.getAttribute('aria-label') ?? one.textContent)
    .filter((name) => ['Add CalDAV', 'Remove Holidays', 'Add Webcal'].includes(name))
  expect(order).toEqual(['Add CalDAV', 'Remove Holidays', 'Add Webcal'])
})
