import { screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import {
  TimelineDayScreen,
  TimelineMonthScreen,
  TimelineWeekScreen,
} from '@/screens/TimelineScreen'
import { pickedDate, press, renderListScreen } from '@/test/support/list-screens'
import { serveEvents } from '@/test/server'

beforeEach(() => {
  vi.setSystemTime(new Date('2026-11-12T10:00:00'))
  serveEvents([])
})

afterEach(() => {
  vi.useRealTimers()
})

it('moves by a day in the day timeline', async () => {
  // given: a Wednesday
  renderListScreen(TimelineDayScreen, '2026-11-11')
  await screen.findByRole('button', { name: 'Next day' })

  // when
  await press('Next day')

  // then
  expect(pickedDate()).toHaveValue('2026-11-12')

  // when
  await press('Previous day')
  await press('Previous day')

  // then
  expect(pickedDate()).toHaveValue('2026-11-10')
})

it('moves by a week in the week timeline, keeping the weekday', async () => {
  // given: a Wednesday
  renderListScreen(TimelineWeekScreen, '2026-11-11')
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

it('moves by a month in the month timeline, keeping the day within the month', async () => {
  // given
  renderListScreen(TimelineMonthScreen, '2026-01-31')
  await screen.findByRole('button', { name: 'Next month' })

  // when
  await press('Next month')

  // then: February has no 31st
  expect(pickedDate()).toHaveValue('2026-02-28')

  // when
  await press('Previous month')

  // then
  expect(pickedDate()).toHaveValue('2026-01-28')
})

it('goes back to today from where the arrows took it', async () => {
  // given
  renderListScreen(TimelineWeekScreen, '2026-11-12')
  await screen.findByRole('button', { name: 'Next week' })
  await press('Next week')

  // when
  await press('Today')

  // then
  expect(pickedDate()).toHaveValue('2026-11-12')
})
