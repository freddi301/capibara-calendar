import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import App from '@/App'
import { renderApp } from '@/test/render'
import { choose, chooseLayout, setUpApp } from '@/test/support/app'
import { setScreenSize } from '@/test/support/month'

vi.mock('@/api/sources', async (original) => ({
  ...(await original<typeof import('@/api/sources')>()),
  checkCaldav: vi.fn(),
}))
vi.mock('@/api', async (original) => ({
  ...(await original<typeof import('@/api')>()),
  resetApi: vi.fn(),
}))

beforeEach(() => {
  setUpApp()
  setScreenSize(true)
})

afterEach(() => {
  vi.useRealTimers()
  setScreenSize(false)
})

it('makes an event from a day of the month table, and shows it there, and stays on the table', async () => {
  // given
  const view = renderApp(<App />)
  await screen.findByRole('button', { name: /Dentist/ })

  // when
  await chooseLayout('Month')
  await userEvent.click(
    await screen.findByRole('button', { name: 'New event: Friday, November 13, 2026' }),
  )

  // then
  expect(await screen.findByLabelText('Start date')).toHaveValue('2026-11-13')

  // when
  await userEvent.type(screen.getByLabelText('Title'), 'Lunch with Ada')
  await choose('Calendar', 'Personal')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  const create = await screen.findByRole('button', { name: 'New event: Friday, November 13, 2026' })
  const cell = create.closest<HTMLElement>('[role="gridcell"]')
  if (!cell) throw new Error('the day has no cell')
  expect(await within(cell).findByRole('button', { name: /Lunch with Ada/ })).toBeInTheDocument()
  expect(screen.getByRole('grid', { name: 'November 2026' })).toBeInTheDocument()

  // when: the page is opened again
  view.unmount()
  renderApp(<App />)

  // then: the month table is still the layout
  await waitFor(() => {
    expect(screen.getByRole('grid', { name: 'November 2026' })).toBeInTheDocument()
  })
})
