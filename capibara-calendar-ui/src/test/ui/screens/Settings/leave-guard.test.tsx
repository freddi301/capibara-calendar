import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import SettingsScreen from '@/screens/SettingsScreen'
import { renderApp } from '@/test/render'
import {
  back,
  expectAskedThenKept,
  expectDiscarded,
  question,
  setUpLeaveGuard,
} from '@/test/support/leave-guard'

vi.mock('@/api/sources', async (original) => ({
  ...(await original<typeof import('@/api/sources')>()),
  checkCaldav: vi.fn(),
}))

beforeEach(setUpLeaveGuard)

function renderSettings() {
  const onClose = vi.fn()
  renderApp(<SettingsScreen onClose={onClose} onConnectionChange={vi.fn()} />)
  return onClose
}

const change = () => userEvent.click(screen.getByRole('button', { name: 'Change' }))

it('goes back from the settings without asking, when the server was not touched', async () => {
  // given
  const onClose = renderSettings()

  // when
  await userEvent.click(back())

  // then
  expect(onClose).toHaveBeenCalledOnce()
})

it('asks before it goes back from the settings, with an address that was typed and not tried', async () => {
  // given
  const onClose = renderSettings()
  await change()

  // when
  await userEvent.type(screen.getByLabelText('Server address'), '2')

  // then
  await expectAskedThenKept(onClose)
  await expectDiscarded(onClose)
})

it('does not ask when what was typed was tried and kept', async () => {
  // given
  const onClose = renderSettings()
  await change()
  await userEvent.type(screen.getByLabelText('Server address'), '2')

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Connect' }))
  await screen.findByText('Connected to the CalDAV server')
  await userEvent.click(back())

  // then
  expect(onClose).toHaveBeenCalledOnce()
  expect(question()).not.toBeInTheDocument()
})
