import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, expect, it } from 'vitest'
import { deleteCount, expectDeleted } from '@/test/server'
import { openOccurrence, setUpRepeat, standup } from '@/test/support/repeat'

beforeEach(setUpRepeat)

it('deletes only that event, after it says that the others stay', async () => {
  // given
  await openOccurrence('Only this event')

  // when
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))

  // then
  const dialog = await screen.findByRole('alertdialog')
  expect(
    within(dialog).getByText('Only this event is deleted. The others of the repeat stay.'),
  ).toBeInTheDocument()

  // when
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

  // then
  await waitFor(() => {
    expect(deleteCount()).toBe(1)
  })
  expectDeleted(standup, 'one')
})

it('deletes this event and the following ones, after it says that the ones before stay', async () => {
  // given
  await openOccurrence('This and following')

  // when
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))

  // then
  const dialog = await screen.findByRole('alertdialog')
  expect(
    within(dialog).getByText('This event and the ones after it are deleted. The ones before stay.'),
  ).toBeInTheDocument()

  // when
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

  // then
  await waitFor(() => {
    expectDeleted(standup, 'following')
  })
})

it('deletes all the events when that is the choice', async () => {
  // given
  await openOccurrence('All events')

  // when
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))

  // then
  const dialog = await screen.findByRole('alertdialog')
  expect(
    within(dialog).getByText('It repeats: all its occurrences are deleted.'),
  ).toBeInTheDocument()

  // when
  await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

  // then
  await waitFor(() => {
    expectDeleted(standup, 'all')
  })
})
