import { describe, expect, it } from 'vitest'
import { daysSpanned, timeSpanned } from '@/lib/duration'

const range = { startDate: '2026-11-12', startTime: '', endDate: '', endTime: '' }

describe('days spanned', () => {
  it('counts a single day as 1', () => {
    expect(daysSpanned(range)).toBe(1)
    expect(daysSpanned({ ...range, endDate: '2026-11-12' })).toBe(1)
  })

  it('counts the first and the last day', () => {
    expect(daysSpanned({ ...range, endDate: '2026-11-14' })).toBe(3)
    expect(daysSpanned({ ...range, endDate: '2026-12-02' })).toBe(21)
  })

  it('is undefined for dates that are incomplete or backwards', () => {
    expect(daysSpanned({ ...range, startDate: '' })).toBeUndefined()
    expect(daysSpanned({ ...range, endDate: '2026-11-10' })).toBeUndefined()
  })
})

describe('time spanned', () => {
  const timed = { ...range, startTime: '09:30', endTime: '11:00' }

  it('is hours and minutes, without days within one day', () => {
    expect(timeSpanned(timed)).toEqual({ days: 0, hours: 1, minutes: 30 })
    expect(timeSpanned({ ...timed, endTime: '09:30' })).toEqual({ days: 0, hours: 0, minutes: 0 })
  })

  it('goes past midnight without counting a day that has not passed', () => {
    expect(
      timeSpanned({ ...timed, startTime: '22:00', endDate: '2026-11-13', endTime: '01:30' }),
    ).toEqual({ days: 0, hours: 3, minutes: 30 })
  })

  it('counts the whole days that passed, and keeps the time beyond them apart', () => {
    expect(timeSpanned({ ...timed, endDate: '2026-11-14' })).toEqual({
      days: 2,
      hours: 1,
      minutes: 30,
    })
    expect(timeSpanned({ ...timed, endDate: '2026-11-14', endTime: '09:30' })).toEqual({
      days: 2,
      hours: 0,
      minutes: 0,
    })
    expect(timeSpanned({ ...timed, endDate: '2026-11-13', endTime: '09:45' })).toEqual({
      days: 1,
      hours: 0,
      minutes: 15,
    })
  })

  it('is undefined without both times, or when the end is before the start', () => {
    expect(timeSpanned({ ...timed, endTime: '' })).toBeUndefined()
    expect(timeSpanned({ ...timed, startTime: '' })).toBeUndefined()
    expect(timeSpanned({ ...timed, endTime: '08:00' })).toBeUndefined()
    expect(timeSpanned({ ...timed, startDate: '' })).toBeUndefined()
  })
})
