import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { activateLocale } from '@/i18n'
import CreateEditEventScreen from '@/screens/CreateEditEventScreen'
import type { CalendarEvent } from '@/test/legacy'
import { renderApp } from '@/test/render'
import { contractOf, failSaves } from '@/test/server'
import {
  back,
  dentistAtWork,
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

function renderEvent(event?: CalendarEvent) {
  const onClose = vi.fn()
  renderApp(<CreateEditEventScreen event={event && contractOf(event)} onClose={onClose} />)
  return onClose
}

it('goes back from an event that was not changed without asking', async () => {
  // given
  const onClose = renderEvent(dentistAtWork)
  await screen.findByRole('combobox', { name: 'Calendar' })

  // when
  await userEvent.click(back())

  // then
  expect(onClose).toHaveBeenCalledOnce()
  expect(question()).not.toBeInTheDocument()
})

it('asks before it goes back from an event that was changed, and the person can keep it', async () => {
  // given
  const onClose = renderEvent(dentistAtWork)

  // when
  await userEvent.type(await screen.findByLabelText('Title'), ' with Sam')
  await expectAskedThenKept(onClose)

  // then
  expect(screen.getByLabelText('Title')).toHaveValue('Dentist with Sam') // nothing was lost
})

it('goes back from the event, when the person says that they do not need it', async () => {
  // given
  const onClose = renderEvent(dentistAtWork)

  // when
  await userEvent.type(await screen.findByLabelText('Title'), 'x')

  // then
  await expectDiscarded(onClose)
})

it('does not ask about a new event that has nothing in it', async () => {
  // given
  const onClose = renderEvent()
  await screen.findByRole('combobox', { name: 'Calendar' })

  // when
  await userEvent.click(back())

  // then
  expect(onClose).toHaveBeenCalledOnce() // nothing typed: nothing to lose
})

it('asks about a new event that has a description', async () => {
  // given
  const onClose = renderEvent()

  // when
  await userEvent.type(await screen.findByLabelText('Description'), 'Bring the forms')

  // then
  await expectAskedThenKept(onClose)
})

it('does not ask when what was changed is put back as it was', async () => {
  // given
  const onClose = renderEvent(dentistAtWork)
  const title = await screen.findByLabelText('Title')

  // when
  await userEvent.type(title, 'x')
  await userEvent.type(title, '{Backspace}')
  await userEvent.click(back())

  // then
  expect(onClose).toHaveBeenCalledOnce()
})

it('keeps what was changed in an event that could not be saved, and goes on asking', async () => {
  // given
  failSaves(new TypeError('Failed to fetch'), 'always')
  const onClose = renderEvent(dentistAtWork)

  // when
  await userEvent.type(await screen.findByLabelText('Title'), ' moved')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))
  await screen.findByRole('alert')

  // then
  await expectAskedThenKept(onClose)
})

it('asks in the language of the app', async () => {
  // given
  await activateLocale('it')
  const onClose = renderEvent(dentistAtWork)
  await userEvent.type(await screen.findByLabelText('Titolo'), 'x')

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Indietro' }))

  // then
  expect(await screen.findByText('Scartare le modifiche?')).toBeInTheDocument()
  expect(screen.getByText('Le modifiche non sono state salvate.')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Continua a modificare' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Scarta' })).toBeInTheDocument()
  expect(onClose).not.toHaveBeenCalled()
})

it('does not use the question of the browser: the page can be closed or reloaded as it is', async () => {
  // given
  renderEvent(dentistAtWork)
  await userEvent.type(await screen.findByLabelText('Title'), 'x')

  // when
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)

  // then
  expect(event.defaultPrevented).toBe(false)
})
