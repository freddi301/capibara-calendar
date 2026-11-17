import { screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import WeekRowsScreen from '@/screens/WeekRowsScreen'
import { serveEvents } from '@/test/server'
import { pickedDate, press, renderListScreen } from '@/test/support/list-screens'

beforeEach(() => {
  vi.setSystemTime(new Date('2026-11-12T10:00:00'))
  serveEvents([])
})

afterEach(() => {
  vi.useRealTimers()
})

it('moves by a week with the arrows of the date line, keeping the weekday', async () => {
  // given: a Wednesday
  renderListScreen(WeekRowsScreen, '2026-11-11')
  await screen.findByRole('button', { name: 'Next week' })

  // when
  await press('Next week')

  // then: the Wednesday of the next week
  expect(pickedDate()).toHaveValue('2026-11-18')

  // when
  await press('Previous week')
  await press('Previous week')

  // then
  expect(pickedDate()).toHaveValue('2026-11-04')
})

it('goes back to today from where the arrows took it', async () => {
  // given
  renderListScreen(WeekRowsScreen, '2026-11-12')
  await screen.findByRole('button', { name: 'Next week' })
  await press('Next week')

  // when
  await press('Today')

  // then
  expect(pickedDate()).toHaveValue('2026-11-12')
})
