import { describe, expect, it } from 'vitest'
import { stepDate } from '@/lib/week'

const date = (iso: string) => Temporal.PlainDate.from(iso)

describe('stepping by a day', () => {
  it('goes to the next and to the previous day, across months and years', () => {
    // given
    const day = date('2026-12-31')

    // when
    const next = stepDate(day, 1, 'day')
    const previous = stepDate(date('2027-03-01'), -1, 'day')

    // then
    expect(next.toString()).toBe('2027-01-01')
    expect(previous.toString()).toBe('2027-02-28')
  })
})

describe('stepping by a week', () => {
  it('keeps the weekday', () => {
    // given: a Wednesday
    const day = date('2026-11-11')

    // when
    const next = stepDate(day, 1, 'week')
    const previous = stepDate(day, -1, 'week')

    // then
    expect(next.toString()).toBe('2026-11-18')
    expect(previous.toString()).toBe('2026-11-04')
    expect([day, next, previous].map(({ dayOfWeek }) => dayOfWeek)).toEqual([3, 3, 3])
  })

  it('crosses the end of the year', () => {
    // given
    const day = date('2026-12-30')

    // when
    const next = stepDate(day, 1, 'week')

    // then
    expect(next.toString()).toBe('2027-01-06')
  })
})

describe('stepping by a month', () => {
  it('keeps the day number', () => {
    // given
    const day = date('2026-11-12')

    // when
    const next = stepDate(day, 1, 'month')
    const previous = stepDate(day, -1, 'month')

    // then
    expect(next.toString()).toBe('2026-12-12')
    expect(previous.toString()).toBe('2026-10-12')
  })

  it('takes the last day of a shorter month', () => {
    // given
    const day = date('2026-01-31')

    // when
    const february = stepDate(day, 1, 'month')
    const leap = stepDate(date('2028-01-30'), 1, 'month')

    // then
    expect(february.toString()).toBe('2026-02-28')
    expect(leap.toString()).toBe('2028-02-29')
  })

  it('crosses the end of the year', () => {
    // given
    const day = date('2026-12-15')

    // when
    const next = stepDate(day, 1, 'month')
    const previous = stepDate(date('2027-01-15'), -1, 'month')

    // then
    expect(next.toString()).toBe('2027-01-15')
    expect(previous.toString()).toBe('2026-12-15')
  })
})
