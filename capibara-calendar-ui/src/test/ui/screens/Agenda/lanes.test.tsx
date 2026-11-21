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

it('keeps the days one under the other, each with its title above its lanes', async () => {
  // given
  renderScreen()

  // when
  await screen.findByRole('button', { name: 'All dayA' })

  // then
  const days = [...document.querySelectorAll<HTMLElement>('[data-day]')]
  expect(days.map((day) => day.dataset.day)).toEqual(['2026-11-12', '2026-11-13'])
  expect(days[0].firstElementChild?.tagName).toBe('H2')
  expect(days[0].querySelectorAll('[data-slot="lanes"] button')).toHaveLength(3)
})
