import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '@/App'
import { renderApp } from '@/test/render'
import { serveEvents } from '@/test/server'
import { calendars, chooseLayout, dentist, setUpApp } from '@/test/support/app'
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

it('remembers the layout that was chosen, and the day that was shown', async () => {
  // given
  const first = renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Saturday, November 14/ }))
  await chooseLayout('Week')

  // when
  first.unmount()
  renderApp(<App />)

  // then
  expect(
    await screen.findByRole('group', { name: /Saturday, November 14, 2026/ }),
  ).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-14')
})

it('follows the day when it changes without leaving the list', async () => {
  // given
  const first = renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Friday, November 13/ }))

  // when
  first.unmount()
  renderApp(<App />)

  // then
  expect(await screen.findByLabelText('Choose a date')).toHaveValue('2026-11-13')
})

it('remembers the screen that was open: the settings, and an event that was being looked at', async () => {
  // given
  const settings = renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Settings' }))

  // when
  settings.unmount()
  const afterSettings = renderApp(<App />)

  // then
  expect(await screen.findByRole('heading', { name: 'Settings' })).toBeInTheDocument()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))
  await userEvent.click(await screen.findByRole('button', { name: /Dentist/ }))
  afterSettings.unmount()
  renderApp(<App />)

  // then
  expect(await screen.findByRole('heading', { name: 'Event' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Dentist' })).toBeInTheDocument()
})

it('starts on the list when what was remembered is not usable', async () => {
  // given
  seedStored({ routeState: { route: { screen: 'layouts' }, layout: 'agenda' } })
  renderApp(<App />)

  // when
  await userEvent.click(await screen.findByRole('button', { name: 'Layouts' }))

  // then
  expect(screen.getByRole('button', { name: 'Agenda' })).toHaveAttribute('aria-pressed', 'true')
})

it('shows the screen of the event after it is saved, and the list after it is left', async () => {
  // given
  serveEvents([dentist], calendars)
  const first = renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Dentist/ }))
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))

  // when
  await userEvent.click(await screen.findByRole('button', { name: 'Save' }))

  // then
  expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument() // the event, looked at

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))
  await screen.findByRole('group', { name: 'Week' })
  first.unmount()
  renderApp(<App />)

  // then
  expect(await screen.findByRole('group', { name: 'Week' })).toBeInTheDocument()
})
