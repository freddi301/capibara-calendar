import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '@/App'
import { renderApp } from '@/test/render'
import { openCreateScreen, openSettings, setUpApp } from '@/test/support/app'

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

async function showDay(day: string) {
  fireEvent.change(await screen.findByLabelText('Choose a date'), { target: { value: day } })
  expect(screen.getByLabelText('Choose a date')).toHaveValue(day)
}

it('comes back to the day that was shown after a new event is closed', async () => {
  // given
  renderApp(<App />)
  await showDay('2026-12-03')

  // when
  await openCreateScreen()
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  // then
  expect(await screen.findByLabelText('Choose a date')).toHaveValue('2026-12-03')
})

it('comes back to the day that was shown after the settings are closed', async () => {
  // given
  renderApp(<App />)
  await showDay('2026-12-03')

  // when
  await openSettings()
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  // then
  expect(await screen.findByLabelText('Choose a date')).toHaveValue('2026-12-03')
})

it('starts the new event on the day that was shown, and still comes back to it', async () => {
  // given
  renderApp(<App />)
  await showDay('2026-12-03')

  // when
  await openCreateScreen()

  // then
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-12-03')

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  // then
  expect(await screen.findByLabelText('Choose a date')).toHaveValue('2026-12-03')
})
