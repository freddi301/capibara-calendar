import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import App from '@/App'
import { renderApp } from '@/test/render'
import { expectSaved, saveCount, serveEvents } from '@/test/server'
import { openCreateScreen } from '@/test/support/app'
import {
  chooseEnding,
  chooseRepeat,
  setUpRepeat,
  standup,
  standupOnThe12th,
} from '@/test/support/repeat'

beforeEach(setUpRepeat)

it('makes an event repeat, and says on which day it ends', async () => {
  // given
  serveEvents([{ ...standup, isRecurring: undefined }])
  renderApp(<App />)
  await userEvent.click(await standupOnThe12th())
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))
  expect(await screen.findByRole('combobox', { name: 'Repeat' })).toHaveTextContent(
    'Does not repeat',
  )
  expect(screen.queryByLabelText('Repeat every')).not.toBeInTheDocument() // nothing to say yet

  // when
  await chooseRepeat('Month')
  await chooseEnding('Ends on')
  await userEvent.type(screen.getByLabelText('Repeat until'), '2027-06-30')
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  await waitFor(() => {
    expect(saveCount()).toBe(1)
  })
  expectSaved(
    expect.objectContaining({
      repeat: 'MONTHLY',
      repeatInterval: '1',
      repeatEnds: 'on',
      repeatUntil: '2027-06-30',
    }),
    expect.anything() as { asymmetricMatch: unknown },
    undefined,
  )
})

it('saves every so many weeks, on the days that are chosen, and for how many times', async () => {
  // given
  serveEvents([{ ...standup, isRecurring: undefined }])
  renderApp(<App />)
  await userEvent.click(await standupOnThe12th())
  await userEvent.click(await screen.findByRole('button', { name: 'Edit' }))

  // when
  await chooseRepeat('Week')
  await userEvent.clear(screen.getByLabelText('Repeat every'))
  await userEvent.type(screen.getByLabelText('Repeat every'), '2')

  // then
  expect(screen.getByRole('button', { name: 'Thursday' })).toHaveAttribute('aria-pressed', 'true') // the day of the event

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Monday' }))
  await userEvent.click(screen.getByRole('button', { name: 'Saturday' }))
  await chooseEnding('Ends after')
  await userEvent.type(screen.getByLabelText('Repeat this many times'), '8')

  // then
  expect(screen.getByText('times')).toBeInTheDocument()

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  await waitFor(() => {
    expect(saveCount()).toBe(1)
  })
  expectSaved(
    expect.objectContaining({
      repeat: 'WEEKLY',
      repeatInterval: '2',
      repeatDays: ['MO', 'TH', 'SA'], // in the order of the week, whatever the order of the taps
      repeatEnds: 'after',
      repeatCount: '8',
    }),
    expect.anything() as { asymmetricMatch: unknown },
    undefined,
  )
})

it('asks for a number of one or more, for how often and for how many times', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()
  await userEvent.type(screen.getByLabelText('Title'), 'Gym')
  await chooseRepeat('Day')
  await userEvent.clear(screen.getByLabelText('Repeat every'))
  await userEvent.type(screen.getByLabelText('Repeat every'), '0')
  await chooseEnding('Ends after')

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  await waitFor(() => {
    expect(screen.getAllByText('Enter a number, 1 or more')).toHaveLength(2) // both
  })
  expect(saveCount()).toBe(0)
})

it('asks for the day that the repeat ends on, when it is to end on one', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()
  await userEvent.type(screen.getByLabelText('Title'), 'Gym')
  await chooseRepeat('Day')
  await chooseEnding('Ends on')

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  expect(await screen.findByText('Choose the day that the repeat ends')).toBeInTheDocument()
  expect(saveCount()).toBe(0)
})

it('does not let the repeat end before the event starts', async () => {
  // given
  renderApp(<App />)
  await openCreateScreen()
  await userEvent.type(screen.getByLabelText('Title'), 'Gym')
  await chooseRepeat('Day')
  await chooseEnding('Ends on')
  await userEvent.type(screen.getByLabelText('Repeat until'), '2026-11-01')

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Save' }))

  // then
  expect(
    await screen.findByText('The repeat cannot end before the event starts'),
  ).toBeInTheDocument()
  expect(saveCount()).toBe(0)
})
