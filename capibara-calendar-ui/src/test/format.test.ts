import { describe, expect, it } from 'vitest'
import {
  capitalize,
  formatDate,
  formatFullDate,
  formatTime,
  formatTimeRange,
  formatWeekday,
} from '../lib/format'

describe('times', () => {
  it('are written with 24 hours, and two digits, in every language: never AM or PM', () => {
    for (const locale of ['en-US', 'en-GB', 'it-IT']) {
      expect(formatTime('09:30', locale)).toBe('09:30')
      expect(formatTime('14:05', locale)).toBe('14:05')
      expect(formatTime('00:15', locale)).toBe('00:15')
    }
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

describe('time ranges', () => {
  it('have the start and the end, with the habit of the language', () => {
    expect(formatTimeRange('09:00', '09:30', 'en-US')).toBe('09:00–09:30')
    expect(formatTimeRange('09:00', '09:30', 'it-IT')).toBe('09:00–09:30')
  })

  it('have only the time there is, and nothing for a whole day', () => {
    expect(formatTimeRange('16:00', '', 'it-IT')).toBe('16:00')
    expect(formatTimeRange('', '01:30', 'it-IT')).toBe('01:30')
    expect(formatTimeRange('', '', 'it-IT')).toBe('')
  })
})

describe('names of days', () => {
  const day = Temporal.PlainDate.from('2026-11-12')

  it('have the weekday short and with a capital, in the language', () => {
    expect(formatWeekday(day, 'en-US')).toBe('Thu')
    expect(formatWeekday(day, 'it-IT')).toBe('Gio')
  })

  it('have the whole date, with the weekday', () => {
    expect(formatFullDate(day, 'en-US')).toBe('Thursday, November 12, 2026')
    expect(formatFullDate(day, 'it-IT')).toBe('giovedì 12 novembre 2026')
    expect(capitalize(formatFullDate(day, 'it-IT'), 'it-IT')).toBe('Giovedì 12 novembre 2026')
  })
})
