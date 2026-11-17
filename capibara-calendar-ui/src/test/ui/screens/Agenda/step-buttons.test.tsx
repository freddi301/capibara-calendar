import { screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { date, renderScreen, setUpAgenda } from '@/test/support/agenda'
import { press } from '@/test/support/list-screens'

let removeSizes: () => void

beforeEach(() => {
  removeSizes = setUpAgenda()
})

afterEach(() => {
  removeSizes()
  vi.useRealTimers()
})

it('moves by a day with the arrows of the date line', async () => {
  // given: Thursday 12 November
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })

  // when
  await press('Next day')

  // then
  expect(date()).toHaveValue('2026-11-13')

  // when
  await press('Previous day')
  await press('Previous day')

  // then
  expect(date()).toHaveValue('2026-11-11')
})

it('goes back to today from where the arrows took it', async () => {
  // given
  renderScreen()
  await screen.findByRole('button', { name: /Standup/ })
  await press('Next day')
  await press('Next day')

  // when
  await press('Today')

  // then
  expect(date()).toHaveValue('2026-11-12')
})
