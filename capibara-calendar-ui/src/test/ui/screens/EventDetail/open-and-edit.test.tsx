import { screen } from '@testing-library/react'
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

it('opens an event only to look at it, and changes it when the pencil is tapped', async () => {
  // given
  renderApp(<App />)

  // when
  await userEvent.click(await screen.findByRole('button', { name: /Dentist/ }))

  // then
  expect(screen.getByRole('heading', { name: 'Event' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Dentist' })).toBeInTheDocument()
  expect(screen.queryByLabelText('Title')).not.toBeInTheDocument() // text, not a form
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Edit' }))

  // then
  expect(screen.getByRole('heading', { name: 'Edit event' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument()
  expect(screen.getByLabelText('Title')).toHaveValue('Dentist')
  expect(screen.queryByText('Edit a repeating event')).not.toBeInTheDocument() // it does not repeat

  // when: discard goes back to the event, as it was
  await userEvent.click(screen.getByRole('button', { name: 'Discard changes' }))

  // then
  expect(screen.getByRole('heading', { name: 'Event' })).toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Dentist' })).toBeInTheDocument()
})
