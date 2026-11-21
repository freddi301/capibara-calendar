import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import App from '@/App'
import { activateLocale } from '@/i18n'
import { renderApp } from '@/test/render'
import { serveEvents } from '@/test/server'
import { openOccurrence, setUpRepeat, standup, standupOnThe12th } from '@/test/support/repeat'

beforeEach(setUpRepeat)

it('asks which of the events to edit, before it opens one that repeats', async () => {
  // given
  renderApp(<App />)

  // when
  await userEvent.click(await standupOnThe12th())
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))

  // then
  expect(await screen.findByText('Edit a repeating event')).toBeInTheDocument()
  expect(
    screen.getByText(
      'Do you want to change only this event, this one and the ones after it, or all the events of the repeat?',
    ),
  ).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Only this event' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'This and following' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'All events' })).toBeInTheDocument()
  expect(screen.queryByRole('heading', { name: 'Edit event' })).not.toBeInTheDocument()
})

it('stays on the event that is looked at when the question is not answered', async () => {
  // given
  await openOccurrence()

  // when
  await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }))

  // then
  await waitFor(() => {
    expect(screen.queryByText('Edit a repeating event')).not.toBeInTheDocument()
  })
  expect(screen.getByRole('heading', { name: 'Event' })).toBeInTheDocument() // not changed yet
  expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
})

it('does not ask which of the events to edit when a repeating event is only looked at', async () => {
  // given
  renderApp(<App />)

  // when
  await userEvent.click(await standupOnThe12th())

  // then
  expect(await screen.findByRole('heading', { name: 'Event' })).toBeInTheDocument()
  expect(screen.queryByText('Edit a repeating event')).not.toBeInTheDocument()
  expect(screen.getByRole('heading', { name: 'Standup' })).toBeInTheDocument()
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument() // text, not fields
  expect(screen.getByText(/^Every week/)).toBeInTheDocument() // how it repeats
  expect(screen.queryByRole('button', { name: 'Save' })).not.toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
})

it('does not ask about an event that does not repeat', async () => {
  // given
  serveEvents([{ ...standup, isRecurring: undefined }])
  renderApp(<App />)

  // when
  await userEvent.click(await standupOnThe12th())

  // then
  expect(await screen.findByRole('heading', { name: 'Standup' })).toBeInTheDocument()
  expect(screen.queryByText('Edit a repeating event')).not.toBeInTheDocument()
})

it('is in the language of the app', async () => {
  // given
  await activateLocale('it')

  // when
  await openOccurrence()

  // then
  expect(await screen.findByText('Modifica un evento ripetuto')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Solo questo evento' })).toBeInTheDocument()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Tutti gli eventi' }))

  // then
  expect(await screen.findByRole('combobox', { name: 'Ripeti' })).toHaveTextContent('Settimana')
  expect(screen.getByLabelText('Ripeti ogni')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'lunedì' })).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Come finisce la ripetizione' })).toHaveTextContent(
    'Non finisce',
  )
})
