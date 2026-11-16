import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '@/App'
import { renderApp } from '@/test/render'
import { saveCount } from '@/test/server'
import { openCreateScreen, setUpApp } from '@/test/support/app'

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

it('marks the end in red when it is before the start', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()

  // when
  fireEvent.change(screen.getByLabelText('Start date'), { target: { value: '2026-11-12' } })
  fireEvent.change(screen.getByLabelText('End date'), { target: { value: '2026-11-10' } })

  // then
  expect(await screen.findByText('The end cannot be before the start')).toBeInTheDocument()
  expect(screen.getByLabelText('End date')).toBeInvalid()
  expect(screen.getByLabelText('Start date')).toBeValid()

  // when
  await userEvent.type(screen.getByLabelText('Title'), 'Trip')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  expect(saveCount()).toBe(0)
})

it('asks for a title before saving', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  expect(await screen.findByText('Enter a title')).toBeInTheDocument()
  expect(saveCount()).toBe(0)
})
