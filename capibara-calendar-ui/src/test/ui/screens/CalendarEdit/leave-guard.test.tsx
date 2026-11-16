import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import CalendarEditScreen from '@/screens/CalendarEditScreen'
import { renderApp } from '@/test/render'
import { calendarInfoOf } from '@/test/server'
import {
  back,
  expectAskedThenKept,
  expectDiscarded,
  question,
  setUpLeaveGuard,
  work,
} from '@/test/support/leave-guard'

vi.mock('@/api/sources', async (original) => ({
  ...(await original<typeof import('@/api/sources')>()),
  checkCaldav: vi.fn(),
}))

beforeEach(setUpLeaveGuard)

it('asks before it goes back from a calendar that was changed, and not from one that was not', async () => {
  // given
  const unchanged = vi.fn()
  const view = renderApp(<CalendarEditScreen calendar={calendarInfoOf(work)} onClose={unchanged} />)
  await screen.findByText('Edit calendar')

  // when
  await userEvent.click(back())

  // then
  expect(unchanged).toHaveBeenCalledOnce()
  view.unmount()

  // given
  const onClose = vi.fn()
  renderApp(<CalendarEditScreen calendar={calendarInfoOf(work)} onClose={onClose} />)

  // when
  await userEvent.click(await screen.findByRole('button', { name: 'Calendar color' }))
  await userEvent.click(screen.getByRole('button', { name: 'Teal' }))

  // then
  await expectAskedThenKept(onClose)
  await expectDiscarded(onClose)
})

it('asks before it goes back from a new calendar with a name', async () => {
  // given
  const onClose = vi.fn()
  renderApp(<CalendarEditScreen onClose={onClose} />)

  // when
  await userEvent.type(await screen.findByLabelText('Name'), 'Family')

  // then
  await expectAskedThenKept(onClose)
  expect(screen.getByLabelText('Name')).toHaveValue('Family')
})

it('does not ask when the calendar was saved, which goes back by itself', async () => {
  // given
  const onClose = vi.fn()
  renderApp(<CalendarEditScreen onClose={onClose} />)
  await userEvent.type(await screen.findByLabelText('Name'), 'Family')

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  await waitFor(() => {
    expect(onClose).toHaveBeenCalledOnce()
  })
  expect(question()).not.toBeInTheDocument()
})
