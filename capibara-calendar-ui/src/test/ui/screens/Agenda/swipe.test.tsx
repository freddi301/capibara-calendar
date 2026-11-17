import { fireEvent, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { date, list, renderScreen, setUpAgenda } from '@/test/support/agenda'
import { at, dragFinger, fireTouch, pinch } from '@/test/support/touch'

let removeSizes: () => void

beforeEach(() => {
  removeSizes = setUpAgenda()
})

afterEach(() => {
  removeSizes()
  vi.useRealTimers()
})

it('goes to the next day with a swipe to the left, and back with a swipe to the right', async () => {
  // given: Thursday 12 November
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // when
  dragFinger(list(), at(300), at(120))

  // then
  expect(date()).toHaveValue('2026-11-13')

  // when
  dragFinger(list(), at(120), at(300))
  dragFinger(list(), at(120), at(300))

  // then
  expect(date()).toHaveValue('2026-11-11')
})

it('swipes also when the finger starts on an event', async () => {
  // given
  const { onEdit } = renderScreen()
  const standup = await screen.findByRole('button', { name: /Standup/ })

  // when
  dragFinger(standup, at(300), at(120))

  // then: the day changed, and the event was not opened
  expect(date()).toHaveValue('2026-11-13')
  expect(onEdit).not.toHaveBeenCalled()
})

it('does not swipe when the finger moved too little, or mostly up and down', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // when: a short move, and a scroll that drifts to the side
  dragFinger(list(), at(300), at(270))
  dragFinger(list(), at(300, 100), at(190, 400))

  // then
  expect(date()).toHaveValue('2026-11-12')
})

it('does not swipe with two fingers, or with the mouse', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // when
  pinch(list(), at(300), at(200))
  fireEvent.mouseDown(list(), { clientX: 300, clientY: 300 })
  fireEvent.mouseMove(list(), { clientX: 100, clientY: 300 })
  fireEvent.mouseUp(list(), { clientX: 100, clientY: 300 })

  // then
  expect(date()).toHaveValue('2026-11-12')
})

it('still opens the menu of an event that is pressed for long', async () => {
  // given
  renderScreen()
  const standup = await screen.findByRole('button', { name: /Standup/ })

  // when: the finger stays down for longer than a press
  fireTouch('touchStart', standup, [at(300)], [at(300)])
  vi.setSystemTime(new Date('2026-11-12T10:00:01'))
  fireTouch('touchEnd', standup, [], [at(300)])

  // then
  expect(await screen.findByRole('menu')).toBeInTheDocument()
  expect(date()).toHaveValue('2026-11-12')
})
