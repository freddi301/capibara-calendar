import { screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { event, renderScreen, setUpAgenda } from '@/test/support/agenda'

let removeSizes: () => void

beforeEach(() => {
  removeSizes = setUpAgenda([
    event('A', {}),
    event('B', {}),
    event('C', {}),
    event('D', { startDate: '2026-11-13' }),
  ])
})

afterEach(() => {
  removeSizes()
  vi.useRealTimers()
})

it('puts the events of a day in lanes: one on a phone, two on a tablet, three on a full desktop', async () => {
  // given
  renderScreen()

  // when
  await screen.findByRole('button', { name: /A/ })

  // then
  const lanes = [...document.querySelectorAll('[data-slot="lanes"]')]
  expect(lanes).toHaveLength(2) // one for each day
  for (const day of lanes) {
    expect(day).toHaveClass('columns-1', 'md:columns-2', '2xl:columns-3')
  }
})

it('keeps the days one under the other, each with its title above its lanes', async () => {
  // given
  renderScreen()

  // when
  await screen.findByRole('button', { name: /A/ })

  // then
  const days = [...document.querySelectorAll<HTMLElement>('[data-day]')]
  expect(days.map((day) => day.dataset.day)).toEqual(['2026-11-12', '2026-11-13'])
  expect(days[0].firstElementChild?.tagName).toBe('H2')
  expect(days[0].querySelectorAll('[data-slot="lanes"] button')).toHaveLength(3)
})
