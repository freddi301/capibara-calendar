import { fireEvent, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  date,
  dayGap,
  list,
  renderScreen,
  scrollList,
  setUpAgenda,
  startOf,
} from '@/test/support/agenda'

let removeSizes: () => void

beforeEach(() => {
  removeSizes = setUpAgenda()
})

afterEach(() => {
  removeSizes()
  vi.useRealTimers()
})

it('has the date line, with the date the list starts on', async () => {
  // when
  renderScreen('2026-11-14')
  await screen.findByRole('button', { name: /Planning/ })

  // then
  expect(date()).toHaveValue('2026-11-14')
  expect(screen.getByRole('combobox', { name: 'Month: November' })).toBeInTheDocument()
  expect(screen.getByRole('combobox', { name: 'Year: 2026' })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
  // The top bar has the line below it, and is as tall as the bottom bar.
  expect(date().closest('.grid')).toHaveClass('border-b', 'h-11')
})

it('shows in the date line the day that is at the top of the list while it scrolls', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // then
  expect(date()).toHaveValue('2026-11-12')

  // when
  scrollList(startOf('2026-11-13') + 50) // Thursday has gone past the top edge
  expect(date()).toHaveValue('2026-11-13')

  scrollList(startOf('2026-11-16')) // a day that is just at the edge counts as the top
  expect(date()).toHaveValue('2026-11-16')

  scrollList(startOf('2026-11-11')) // the days before the one that the list started on
  expect(date()).toHaveValue('2026-11-11')
})

it('creates an event and opens the layouts with the day that scrolling has reached', async () => {
  // given
  const { onCreate, onOpenLayouts } = renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // when
  scrollList(startOf('2026-11-13') + 50)

  await userEvent.click(screen.getByRole('button', { name: 'New event' }))
  await userEvent.click(screen.getByRole('button', { name: 'Layouts' }))

  // then
  expect(onCreate).toHaveBeenCalledExactlyOnceWith('2026-11-13')
  expect(onOpenLayouts).toHaveBeenCalledExactlyOnceWith('2026-11-13')
})

it('starts the list on the date that is chosen, at its top', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // when
  scrollList(startOf('2026-11-16'))

  fireEvent.change(date(), { target: { value: '2026-11-14' } })

  // then
  expect(date()).toHaveValue('2026-11-14')
  expect(list().scrollTop).toBe(startOf('2026-11-14') + dayGap)
})

it('goes back to today with the Today button, scrolled or not', async () => {
  // given
  renderScreen('2026-11-14')
  await screen.findByRole('button', { name: /Planning/ })

  // when
  await userEvent.click(screen.getByRole('button', { name: 'Today' }))

  // then
  expect(date()).toHaveValue('2026-11-12')
  expect(list().scrollTop).toBe(startOf('2026-11-12') + dayGap)
})
