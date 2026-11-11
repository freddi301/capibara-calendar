import { describe, expect, it } from 'vitest'
import { formatDate, formatTime, usesTwelveHours } from '../lib/format'

describe('times', () => {
  it('are written with AM and PM in English', () => {
    expect(usesTwelveHours('en-US')).toBe(true)
    expect(formatTime('09:30', 'en-US')).toBe('9:30 AM')
    expect(formatTime('14:05', 'en-US')).toBe('2:05 PM')
    expect(formatTime('00:15', 'en-US')).toBe('12:15 AM')
  })

  it('are written with 24 hours, and two digits, in Italian', () => {
    expect(usesTwelveHours('it-IT')).toBe(false)
    expect(formatTime('09:30', 'it-IT')).toBe('09:30')
    expect(formatTime('14:05', 'it-IT')).toBe('14:05')
  })
})

describe('dates', () => {
  it('have the month first in US English and the day first in Italian and British English', () => {
    expect(formatDate('2026-11-12', 'en-US')).toBe('11/12/2026')
    expect(formatDate('2026-11-12', 'it-IT')).toBe('12/11/2026')
    expect(formatDate('2026-11-12', 'en-GB')).toBe('12/11/2026')
  })

  it('always have two digits for the day and the month, and four for the year', () => {
    expect(formatDate('2026-01-05', 'en-US')).toBe('01/05/2026')
    expect(formatDate('2026-01-05', 'it-IT')).toBe('05/01/2026')
  })
})
