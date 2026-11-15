import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, expect, it, vi } from 'vitest'
import { setApi } from '../api'
import { contactId, type CalendarApi } from '../api/calendar-api'
import ParticipantsEditor from '../components/ParticipantsEditor'
import { renderApp } from './render'

const value = [
  { id: 'me', status: 'needs-action' as const },
  { id: 'ada', status: 'needs-action' as const },
]

function renderEditor() {
  setApi({
    listContacts: () =>
      Promise.resolve([
        { id: contactId('me'), name: 'Me' },
        { id: contactId('ada'), name: 'Ada' },
      ]),
    subscribe: () => () => undefined,
  } as unknown as CalendarApi)
  const onChange = vi.fn()
  renderApp(<ParticipantsEditor value={value} isReadOnly={false} onChange={onChange} />)
  return onChange
}

async function answer(name: string, status: string) {
  await userEvent.click(await screen.findByRole('combobox', { name: `Answer of ${name}` }))
  await userEvent.click(await screen.findByRole('option', { name: status }))
}

afterEach(() => {
  Reflect.deleteProperty(window, 'webxdc')
})

it('asks before it changes the answer of someone else in a chat, and not for the answer of the person', async () => {
  Object.assign(window, { webxdc: { selfAddr: 'me' } })
  const onChange = renderEditor()

  await answer('Me', 'Accepted')
  expect(onChange).toHaveBeenCalledWith([{ id: 'me', status: 'accepted' }, value[1]])
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  onChange.mockClear()

  await answer('Ada', 'Declined')
  expect(await screen.findByRole('alertdialog')).toHaveTextContent(
    'You are changing the answer of Ada',
  )
  expect(onChange).not.toHaveBeenCalled()

  await userEvent.click(screen.getByRole('button', { name: 'Keep their answer' }))
  expect(onChange).not.toHaveBeenCalled() // nothing was changed

  await answer('Ada', 'Declined')
  await userEvent.click(await screen.findByRole('button', { name: 'Change it' }))
  expect(onChange).toHaveBeenCalledWith([value[0], { id: 'ada', status: 'declined' }])
})

const nobody = [{ id: 'me', status: 'needs-action' as const }]

async function openThePicker() {
  setApi({
    listContacts: () =>
      Promise.resolve([
        { id: contactId('ada'), name: 'Ada' },
        { id: contactId('bruno'), name: 'Bruno' },
        { id: contactId('carla'), name: 'Carla' },
      ]),
    subscribe: () => () => undefined,
  } as unknown as CalendarApi)
  const onChange = vi.fn()
  renderApp(<ParticipantsEditor value={nobody} isReadOnly={false} onChange={onChange} />)
  await userEvent.click(screen.getByRole('button', { name: 'Add attendee' }))
  await screen.findByRole('button', { name: 'Ada' })
  return onChange
}

it('adds all the people that are shown at once, in a chat', async () => {
  Object.assign(window, { webxdc: { selfAddr: 'me', selfName: 'Me' } })
  const onChange = await openThePicker()
  await userEvent.type(screen.getByLabelText('Search contacts'), 'br')
  await userEvent.click(await screen.findByRole('button', { name: 'Add all' }))

  expect(onChange).toHaveBeenCalledWith([...nobody, { id: 'bruno', status: 'needs-action' }]) // the ones that are shown
})

it('does not offer to add all the people outside of a chat', async () => {
  await openThePicker()

  expect(screen.queryByRole('button', { name: 'Add all' })).not.toBeInTheDocument()
})

it('does not ask outside of a chat', async () => {
  const onChange = renderEditor()

  await answer('Ada', 'Declined')

  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  expect(onChange).toHaveBeenCalledWith([value[0], { id: 'ada', status: 'declined' }])
})
