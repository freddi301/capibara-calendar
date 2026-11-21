import { describe, expect, it } from 'vitest'
import type { CalendarEvent } from '@/test/legacy'
import { displayOf } from '@/test/server'
import { agendaDays, eventsOn, monthStrip, monthWeeks, weekDays } from '@/lib/week'

const date = (iso: string) => Temporal.PlainDate.from(iso)

function event(title: string, fields: Partial<CalendarEvent> = {}) {
  return displayOf({
    calendarUrl: '/c/',
    uid: title,
    url: `/c/${title}.ics`,
    ics: '',
    title,
    description: '',
    startDate: '2026-11-12',
    startTime: '',
    endDate: '',
    endTime: '',
    ...fields,
  })
}

const titles = (events: ReturnType<typeof event>[], day: string) =>
  eventsOn(events, date(day)).map(({ event }) => event.title)

describe('week days', () => {
  it('starts on Monday and has seven days', () => {
    expect(weekDays(date('2026-11-11')).map(String)).toEqual([
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
      '2026-11-15',
    ])
  })

  it('is the same week for every day in it, Monday and Sunday included', () => {
    const week = weekDays(date('2026-11-09')).map(String)
    for (const day of week) expect(weekDays(date(day)).map(String)).toEqual(week)
  })

  it('crosses months and years', () => {
    expect(weekDays(date('2026-11-01')).map(String)[0]).toBe('2026-10-26') // a Sunday
    expect(weekDays(date('2027-01-01')).map(String)).toContain('2026-12-28') // a Friday
  })
})

describe('week days with another first day', () => {
  const week = (iso: string, weekStart: number) => weekDays(date(iso), weekStart).map(String)

  it('starts on Sunday', () => {
    expect(week('2026-11-11', 7)).toEqual([
      '2026-11-08',
      '2026-11-09',
      '2026-11-10',
      '2026-11-11',
      '2026-11-12',
      '2026-11-13',
      '2026-11-14',
    ])
  })

  it('starts on Saturday', () => {
    expect(week('2026-11-11', 6)[0]).toBe('2026-11-07')
    expect(week('2026-11-11', 6)[6]).toBe('2026-11-13')
  })

  it('has the first day at the start of its own week, and the day before in the week before', () => {
    expect(week('2026-11-08', 7)[0]).toBe('2026-11-08') // a Sunday, the first day
    expect(week('2026-11-07', 7)[0]).toBe('2026-11-01') // the Saturday before it
    expect(week('2026-11-14', 7)).toContain('2026-11-14')
  })

  it('is always seven days that contain the date, whatever the first day is', () => {
    for (let weekStart = 1; weekStart <= 7; weekStart++) {
      for (const day of ['2026-11-09', '2026-11-12', '2026-11-15', '2026-12-31', '2027-01-01']) {
        const days = week(day, weekStart)
        expect(days).toHaveLength(7)
        expect(days).toContain(day)
        expect(date(days[0]).dayOfWeek).toBe(weekStart)
      }
    }
  })
})

describe('month weeks', () => {
  const weeks = (iso: string, weekStart?: number) =>
    monthWeeks(date(iso), weekStart).map((week) => week.map(String))

  it('has whole weeks, from the week of the 1st to the week of the last day', () => {
    const november = weeks('2026-11-12') // 1 November is a Sunday, 30 a Monday
    expect(november).toHaveLength(6)
    expect(november[0][0]).toBe('2026-10-26')
    expect(november[5][6]).toBe('2026-12-06')
  })

  it('has only the weeks that are needed', () => {
    expect(weeks('2026-11-12', 7)).toHaveLength(5) // Sunday first: 1 to 30 November
    expect(weeks('2027-02-10')).toHaveLength(4) // 1 February 2027 is a Monday: 1 to 28
    expect(weeks('2027-02-10')[0][0]).toBe('2027-02-01')
    expect(weeks('2026-02-10')).toHaveLength(5) // 1 February 2026 is a Sunday: 2 to 28
    expect(weeks('2026-02-10')[0][0]).toBe('2026-01-26')
  })

  it('is the same for every day of the month', () => {
    const month = weeks('2026-11-01')
    for (let day = 1; day <= 30; day++) {
      expect(weeks(`2026-11-${String(day).padStart(2, '0')}`)).toEqual(month)
    }
  })

  it('has every day of the month once, in order', () => {
    const days = weeks('2026-11-12').flat()
    expect(days).toHaveLength(42)
    for (let index = 1; index < days.length; index++) {
      expect(date(days[index]).since(date(days[index - 1])).days).toBe(1)
    }
  })
})

describe('events on a day', () => {
  it('has only the events of that day', () => {
    const events = [event('A'), event('B', { startDate: '2026-11-13' })]
    expect(titles(events, '2026-11-12')).toEqual(['A'])
    expect(titles(events, '2026-11-13')).toEqual(['B'])
    expect(titles(events, '2026-11-14')).toEqual([])
  })

  it('has a multi-day event on every day it covers, with the last day included', () => {
    const events = [event('Trip', { endDate: '2026-11-14' })]
    expect(titles(events, '2026-11-11')).toEqual([])
    expect(titles(events, '2026-11-12')).toEqual(['Trip'])
    expect(titles(events, '2026-11-13')).toEqual(['Trip'])
    expect(titles(events, '2026-11-14')).toEqual(['Trip'])
    expect(titles(events, '2026-11-15')).toEqual([])
  })

  it('shows the times of a timed event within one day', () => {
    const events = [event('Lunch', { startTime: '12:30', endTime: '13:30' })]
    expect(eventsOn(events, date('2026-11-12'))[0]).toMatchObject({ start: '12:30', end: '13:30' })
  })

  it('shows the start on the first day, the end on the last, and nothing in between', () => {
    const events = [event('Night', { startTime: '22:00', endDate: '2026-11-14', endTime: '01:30' })]
    const [first] = eventsOn(events, date('2026-11-12'))
    const [middle] = eventsOn(events, date('2026-11-13'))
    const [last] = eventsOn(events, date('2026-11-14'))
    expect([first.start, first.end]).toEqual(['22:00', ''])
    expect([middle.start, middle.end]).toEqual(['', ''])
    expect([last.start, last.end]).toEqual(['', '01:30'])
  })

  it('lists the events without a time first, then by time, then by title', () => {
    const events = [
      event('Gym', { startTime: '18:00' }),
      event('Standup', { startTime: '09:00', endTime: '09:30' }),
      event('Birthday'),
      event('Call', { startTime: '09:00' }),
      event('Conference', { endDate: '2026-11-14' }),
    ]
    expect(titles(events, '2026-11-12')).toEqual([
      'Birthday',
      'Conference',
      'Call',
      'Standup',
      'Gym',
    ])
  })

  it('lists the last day of a night event, which has an end only, before the ones with a start', () => {
    const events = [
      event('Gym', { startDate: '2026-11-13', startTime: '07:00' }),
      event('Night', { startTime: '22:00', endDate: '2026-11-13', endTime: '01:30' }),
    ]
    expect(titles(events, '2026-11-13')).toEqual(['Night', 'Gym'])
  })
})

describe('agenda days', () => {
  const days = (events: ReturnType<typeof event>[], start: string, end = '2026-12-31') =>
    agendaDays(events, { start, end }).map(({ day }) => day.toString())

  it('has only the days with events, in order, inside the range', () => {
    const events = [
      event('B', { startDate: '2026-11-20' }),
      event('A', { startDate: '2026-11-12' }),
      event('Past', { startDate: '2026-11-01' }),
    ]
    expect(days(events, '2026-11-12')).toEqual(['2026-11-12', '2026-11-20'])
    expect(days(events, '2026-11-13')).toEqual(['2026-11-20'])
  })

  it('has a multi-day event on each of its days, the ones before the first day left out', () => {
    const events = [event('Trip', { startDate: '2026-11-10', endDate: '2026-11-13' })]
    expect(days(events, '2026-11-12')).toEqual(['2026-11-12', '2026-11-13'])
  })

  it('has the entries of each day, and stops at the end of the range', () => {
    const events = [
      event('A'),
      event('B', { startTime: '09:00' }),
      event('Far', { startDate: '2028-01-01' }),
    ]
    const [first] = agendaDays(events, { start: '2026-11-12', end: '2026-12-31' })
    expect(first.entries.map(({ event }) => event.title)).toEqual(['A', 'B'])
    expect(days(events, '2026-11-12')).toEqual(['2026-11-12'])
    expect(days(events, '2026-11-12', '2028-12-31')).toEqual(['2026-11-12', '2028-01-01'])
  })
})

describe('month strip', () => {
  const daysOf = (weeks: Temporal.PlainDate[][]) => weeks.flat().map(String)

  it('rests on the week of the 1st of the previous, the current and the next month', () => {
    // given: Monday is the first day, and the 1st of November 2026 is a Sunday
    const day = date('2026-11-12')

    // when
    const { weeks, snaps } = monthStrip(day)

    // then
    expect(weeks[0].map(String)[0]).toBe('2026-09-28')
    expect(snaps).toEqual([0, 4, 9])
    const [previous, current, next] = snaps.map((index) => daysOf([weeks[index]]))
    expect(previous).toContain('2026-10-01')
    expect(current).toContain('2026-11-01')
    expect(next).toContain('2026-12-01')
  })

  it('has the weeks that fill the table after the last place to rest on', () => {
    // given / when
    const { weeks, snaps } = monthStrip(date('2026-11-12'))

    // then
    expect(weeks.length - snaps[2]).toBe(6)
  })

  it('has every day once, one after the other', () => {
    for (const weekStart of [1, 7]) {
      for (const day of ['2026-11-12', '2027-02-10', '2026-12-31']) {
        // given / when
        const days = daysOf(monthStrip(date(day), weekStart).weeks)

        // then
        const first = date(days[0])
        expect(days).toEqual(days.map((_, index) => first.add({ days: index }).toString()))
      }
    }
  })

  it('is the same for every day of a month', () => {
    // given / when
    const first = monthStrip(date('2026-11-01'))
    const last = monthStrip(date('2026-11-30'))

    // then
    expect(daysOf(last.weeks)).toEqual(daysOf(first.weeks))
    expect(last.snaps).toEqual(first.snaps)
  })

  it('starts the weeks on the first day of the week that is asked for', () => {
    // given / when: the 1st of November 2026 is a Sunday
    const { weeks, snaps } = monthStrip(date('2026-11-12'), 7)

    // then
    expect(weeks.every((week) => week[0].dayOfWeek === 7)).toBe(true)
    expect(weeks[snaps[1]][0].toString()).toBe('2026-11-01')
  })

  it('rests four weeks apart for a month that is four weeks, and five for one that is more', () => {
    // given: February 2027 runs from a Monday to a Sunday
    const february = monthStrip(date('2027-02-10'))
    const november = monthStrip(date('2026-11-12'))

    // then
    expect(february.snaps[2] - february.snaps[1]).toBe(4)
    expect(november.snaps[2] - november.snaps[1]).toBe(5)
  })
})
