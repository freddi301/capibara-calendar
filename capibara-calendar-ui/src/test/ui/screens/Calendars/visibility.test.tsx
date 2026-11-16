import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '@/App'
import { renderApp } from '@/test/render'
import { setUpApp } from '@/test/support/app'

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

it('opens from the bottom bar, and goes back to the list', async () => {
  // given
  renderApp(<App />)

  // when
  await userEvent.click(await screen.findByRole('button', { name: 'Calendars' }))

  // then
  expect(await screen.findByRole('heading', { name: 'Calendars' })).toBeInTheDocument()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  // then
  expect(await screen.findByRole('group', { name: 'Week' })).toBeInTheDocument()
})

it('hides the events of the calendar that is switched off, and shows them when it is back on', async () => {
  // given
  renderApp(<App />)
  expect(await screen.findByRole('button', { name: /Dentist/ })).toBeInTheDocument()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Calendars' }))
  await userEvent.click(await screen.findByRole('switch', { name: 'Personal' }))
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  // then
  await screen.findByRole('group', { name: 'Week' })
  expect(screen.queryByRole('button', { name: /Dentist/ })).not.toBeInTheDocument()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Calendars' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Show all' }))
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  // then
  expect(await screen.findByRole('button', { name: /Dentist/ })).toBeInTheDocument()
})

it('shows how many calendars are on out of all of them', async () => {
  // given
  renderApp(<App />)
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Calendars' })).toHaveTextContent('2/2')
  })

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Calendars' }))
  await userEvent.click(await screen.findByRole('switch', { name: 'Work' }))
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  // then
  await waitFor(() => {
    expect(screen.getByRole('button', { name: 'Calendars' })).toHaveTextContent('1/2')
  })
})
