import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it, vi } from 'vitest'
import { getApi } from '@/api'
import App from '@/App'
import { renderApp } from '@/test/render'
import { expectSaved, saveCount, serveEvents } from '@/test/server'
import {
  chooseRepeat,
  ics,
  openOccurrence,
  setUpRepeat,
  standup,
  standupOnThe12th,
} from '@/test/support/repeat'

beforeEach(setUpRepeat)

it('opens only that event, from its own day, with what is only of it', async () => {
  // when
  await openOccurrence('Only this event')

  // then
  expect(await screen.findByLabelText('Title')).toHaveValue('Standup')
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-12') // not the first of the repeat
  expect(
    screen.getByText('Only this event changes. The others of the repeat stay as they are.'),
  ).toBeInTheDocument()
  expect(screen.queryByRole('combobox', { name: 'Repeat' })).not.toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Calendar' })).toBeDisabled() // it is in its calendar
})

it('saves only that event, and goes to its screen', async () => {
  // given
  await openOccurrence('Only this event')
  await userEvent.clear(await screen.findByLabelText('Title'))
  await userEvent.type(screen.getByLabelText('Title'), 'Standup, longer')

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  await waitFor(() => {
    expect(saveCount()).toBe(1)
  })
  expectSaved(
    expect.objectContaining({ title: 'Standup, longer', startDate: '2026-11-12' }),
    standup,
    'one',
  )
  expect(await screen.findByRole('button', { name: 'Edit' })).toBeInTheDocument() // the event, looked at

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Back' }))

  // then
  expect(await screen.findByRole('group', { name: 'Week' })).toBeInTheDocument()
})

it('opens this event and the following ones from the day of the occurrence, with how they repeat', async () => {
  // when
  await openOccurrence('This and following')

  // then
  expect(await screen.findByLabelText('Title')).toHaveValue('Standup')
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-12') // the occurrence, not the first
  expect(
    screen.getByText('This event and the ones after it change. The ones before stay as they are.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Repeat' })).toHaveTextContent('Week')
  expect(screen.getByRole('combobox', { name: 'Calendar' })).toBeEnabled()
})

it('saves this event and the following ones, as the scope of the change', async () => {
  // given
  await openOccurrence('This and following')
  await userEvent.clear(await screen.findByLabelText('Title'))
  await userEvent.type(screen.getByLabelText('Title'), 'Standup, from now')

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  await waitFor(() => {
    expect(saveCount()).toBe(1)
  })
  expectSaved(
    expect.objectContaining({
      title: 'Standup, from now',
      startDate: '2026-11-12',
      repeat: 'WEEKLY',
    }),
    standup,
    'following',
  )
})

it('opens all the events as the event, from the day it started on, with how it repeats', async () => {
  // when
  await openOccurrence('All events')

  // then
  expect(await screen.findByLabelText('Title')).toHaveValue('Standup')
  expect(screen.getByLabelText('Start date')).toHaveValue('2026-11-05') // the first of the repeat
  expect(
    screen.getByText('This event repeats. Changes are made to all its occurrences.'),
  ).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Repeat' })).toHaveTextContent('Week')
  expect(screen.getByLabelText('Repeat every')).toHaveValue(1)
  expect(screen.getByRole('button', { name: 'Thursday' })).toHaveAttribute('aria-pressed', 'true') // the day of the start
  expect(screen.getByRole('combobox', { name: 'How the repeat ends' })).toHaveTextContent(
    'Does not end',
  )
  expect(screen.queryByLabelText('Repeat until')).not.toBeInTheDocument()
})

it('saves all the events', async () => {
  // given
  await openOccurrence('All events')
  await userEvent.clear(await screen.findByLabelText('Title'))
  await userEvent.type(screen.getByLabelText('Title'), 'Daily standup')

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  await waitFor(() => {
    expect(saveCount()).toBe(1)
  })
  expectSaved(expect.objectContaining({ title: 'Daily standup', repeat: 'WEEKLY' }), standup, 'all')
  // The title is all that was changed, and it is all that is told.
  expect(vi.mocked(getApi().updateEvent).mock.calls.at(-1)?.[1]).toEqual({ title: 'Daily standup' })
})

it('takes the repeat away from an event, which then has none', async () => {
  // given
  await openOccurrence('All events')
  await chooseRepeat('Does not repeat')
  expect(screen.queryByLabelText('Repeat until')).not.toBeInTheDocument()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  await waitFor(() => {
    expect(saveCount()).toBe(1)
  })
  expectSaved(expect.objectContaining({ repeat: '' }), standup, 'all')
})

it('keeps a repeat that the form cannot say as it is, and says so', async () => {
  // given
  const custom = {
    ...standup,
    ics: ics.replace('RRULE:FREQ=WEEKLY', 'RRULE:FREQ=MONTHLY;BYMONTHDAY=12,15'),
  }
  serveEvents([custom])
  renderApp(<App />)
  await userEvent.click(await standupOnThe12th())
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  await userEvent.click(await screen.findByRole('button', { name: 'All events' }))

  // then
  expect(await screen.findByRole('combobox', { name: 'Repeat' })).toHaveTextContent(
    'Custom, kept as it is',
  )
  expect(screen.queryByLabelText('Repeat every')).not.toBeInTheDocument() // the rows cannot say it

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  await waitFor(() => {
    expectSaved(expect.objectContaining({ repeat: 'custom' }), custom, 'all')
  })
})
