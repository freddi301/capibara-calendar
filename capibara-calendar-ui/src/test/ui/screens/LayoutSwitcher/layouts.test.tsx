import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '@/App'
import { renderApp } from '@/test/render'
import { chooseLayout, setUpApp } from '@/test/support/app'

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

it('has the layouts in the order of Agenda and Week, with the Agenda in use at first', async () => {
  // given
  renderApp(<App />)

  // when
  await userEvent.click(await screen.findByRole('button', { name: 'Layouts' }))

  // then
  const options = screen
    .getAllByRole('button')
    .map((button) => button.textContent)
    .filter((text) => ['Agenda', 'Week'].includes(text))
  expect(options).toEqual(['Agenda', 'Week'])
  expect(screen.getByRole('button', { name: 'Agenda' })).toHaveAttribute('aria-pressed', 'true')
  expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'false')
  expect(screen.queryByRole('button', { name: 'Days' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Month' })).not.toBeInTheDocument()
})

it('switches between the layouts, keeping the selected day', async () => {
  // given
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Saturday, November 14/ }))

  // when
  await chooseLayout('Week')

  // then
  expect(screen.getByRole('group', { name: /Saturday, November 14, 2026/ })).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-14')

  // when
  await chooseLayout('Agenda')

  // then
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-14')
  expect(screen.getByRole('group', { name: 'Week' })).toBeInTheDocument() // the strip of the agenda
})

it('marks the layout in use, and goes back without changing it', async () => {
  // given
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Layouts' }))

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Close' }))

  // then
  expect(screen.getByRole('group', { name: 'Week' })).toBeInTheDocument()
})

it('comes back to the layout that was chosen, from the screens opened by the bottom bar', async () => {
  // given
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: 'Layouts' }))
  await userEvent.click(screen.getByRole('button', { name: 'Week' }))

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Settings' }))
  await userEvent.click(await screen.findByRole('button', { name: 'Back' }))

  // then
  expect(screen.getByRole('group', { name: /Thursday, November 12, 2026/ })).toBeInTheDocument()
})

it('shows the week as rows, from the selected day, and keeps it as the layout', async () => {
  // given
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Saturday, November 14/ }))

  // when
  await chooseLayout('Week')

  // then
  expect(screen.getByRole('group', { name: /Saturday, November 14, 2026/ })).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-14')
  await userEvent.click(screen.getByRole('button', { name: 'Layouts' }))
  expect(screen.getByRole('button', { name: 'Week' })).toHaveAttribute('aria-pressed', 'true')
})

it('shows the week or the month under the date line, with the button on the line below it', async () => {
  // given
  renderApp(<App />)
  await userEvent.click(await screen.findByRole('button', { name: /Saturday, November 14/ }))

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Show the month' }))

  // then
  expect(screen.getByRole('group', { name: 'Month' })).toBeInTheDocument()
  expect(screen.queryByRole('group', { name: 'Week' })).not.toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Saturday, November 14/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  ) // the day that was selected, in the month
  expect(screen.getByRole('button', { name: 'Show the week' })).toHaveAttribute(
    'aria-expanded',
    'true',
  )

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Show the week' }))

  // then
  expect(screen.getByRole('group', { name: 'Week' })).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-14')
})
