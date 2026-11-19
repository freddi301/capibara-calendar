import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { expect, it, vi } from 'vitest'
import { getApi } from '@/api'
import { scrollToPage } from '@/test/pager'
import { renderScreen, row, rowsPager, setUpWeekRows } from '@/test/support/week-rows'

setUpWeekRows()

const swipe = (direction: 'next' | 'previous') =>
  scrollToPage(rowsPager(), 'y', direction === 'next' ? 2 : 0)

const starts = () =>
  vi
    .mocked(getApi().listEvents)
    .mock.calls.map(([, range]) => range.start)
    .sort()

it('has the week before and the week after above and below the week, for what is scrolled to', async () => {
  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(rowsPager().children).toHaveLength(3)
  expect(rowsPager()).toHaveClass('snap-y')
  const hidden = screen.getAllByRole('group', { name: /Monday, November 16, 2026/, hidden: true })
  expect(hidden[0].closest('[aria-hidden="true"]')).not.toBeNull() // the next week, below
  expect(screen.queryByRole('group', { name: /Monday, November 16, 2026/ })).not.toBeInTheDocument()
})

it('goes to the next week when it stops on it, and to the week before when it stops on that', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // when
  await swipe('next')

  // then
  expect(await screen.findByRole('button', { name: /Planning/ })).toBeInTheDocument()
  expect(row(/Monday, November 16/)).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-19')

  // when
  await swipe('previous')
  await swipe('previous')

  // then
  expect(row(/Monday, November 2/)).toBeInTheDocument()
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-05')
})

it('stays on the week when it stops on the page that is shown', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // when
  await scrollToPage(rowsPager(), 'y', 1)

  // then
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-12')
})

it('creates an event and opens the layouts with the selected day', async () => {
  // given
  const { onCreate, onOpenLayouts } = renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  await swipe('next')

  // when
  await userEvent.click(screen.getByRole('button', { name: 'New event' }))
  await userEvent.click(screen.getByRole('button', { name: 'Layouts' }))

  // then
  expect(onCreate).toHaveBeenCalledExactlyOnceWith('2026-11-19')
  expect(onOpenLayouts).toHaveBeenCalledExactlyOnceWith('2026-11-19')
})

it('starts on the date it is given, and goes back to today', async () => {
  // given
  renderScreen('2026-12-25')
  await screen.findByRole('group', { name: /Friday, December 25/ })

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Today' }))

  // then
  expect(screen.getByLabelText('Choose a date')).toHaveValue('2026-11-12')
  expect(row(/Thursday, November 12/)).toBeInTheDocument()
})

it('asks the server for the month of the weeks that it shows, and the months beside it', async () => {
  // when
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  await vi.waitFor(() => {
    expect(starts()).toEqual([
      '2026-10-01', // the month before
      '2026-11-01', // the month of the week
      '2026-12-01', // the month after
    ])
  })
})
