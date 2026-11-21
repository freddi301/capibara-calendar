import ICAL from 'ical.js'
import { describe, expect, it } from 'vitest'
import { addNode, emptyFilter, newRule } from '@/lib/event-filter'
import { buildCalendarFile, countEvents, icsFileName, splitByFilter } from '@/lib/ics-file'

const part = (...lines: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//x//EN', ...lines, 'END:VCALENDAR', ''].join('\r\n')

const oneOff = part(
  'BEGIN:VEVENT',
  'UID:one-off',
  'DTSTAMP:20260101T000000Z',
  'SUMMARY:Dentist',
  'DTSTART;TZID=Europe/Rome:20261112T093000',
  'DTEND;TZID=Europe/Rome:20261112T103000',
  'X-KEPT:as it was',
  'END:VEVENT',
)

const series = part(
  'BEGIN:VEVENT',
  'UID:weekly',
  'DTSTAMP:20260101T000000Z',
  'SUMMARY:Standup',
  'DTSTART;TZID=Europe/Rome:20261105T090000',
  'RRULE:FREQ=WEEKLY',
  'END:VEVENT',
  'BEGIN:VEVENT',
  'UID:weekly',
  'DTSTAMP:20260101T000000Z',
  'RECURRENCE-ID;TZID=Europe/Rome:20261112T090000',
  'SUMMARY:Standup (moved)',
  'DTSTART;TZID=Europe/Rome:20261112T100000',
  'END:VEVENT',
)

const parsed = (text: string) => new ICAL.Component(ICAL.parse(text) as unknown[])

describe('how many events and occurrences there are to export', () => {
  it('counts a series as one event, and each customized occurrence of it on its own', () => {
    expect(countEvents([oneOff, series])).toEqual({ events: 2, series: 1, occurrences: 1 })
  })

  it('is nothing for a calendar with nothing in it, and does not mind a part that cannot be read', () => {
    expect(countEvents([])).toEqual({ events: 0, series: 0, occurrences: 0 })
    expect(countEvents(['this is not a calendar'])).toEqual({
      events: 0,
      series: 0,
      occurrences: 0,
    })
  })
})

describe('the file of a calendar', () => {
  const file = buildCalendarFile('Personal', [oneOff, series])
  const calendar = parsed(file)

  it('is one calendar with its name, with all the events of the parts, series and their occurrences', () => {
    expect(calendar.getFirstPropertyValue('version')).toBe('2.0')
    expect(calendar.getFirstPropertyValue('x-wr-calname')).toBe('Personal')
    const events = calendar.getAllSubcomponents('vevent')
    expect(events.map((event) => event.getFirstPropertyValue('summary'))).toEqual([
      'Dentist',
      'Standup',
      'Standup (moved)',
    ])
    expect(events[2].hasProperty('recurrence-id')).toBe(true)
  })

  it('keeps the properties that the app does not know, as they were', () => {
    expect(file).toContain('X-KEPT:as it was')
  })

  it('ends each line with CR and LF, the last one too', () => {
    expect(file.endsWith('\r\n')).toBe(true)
    expect(/[^\r]\n/.test(file)).toBe(false)
  })

  it('defines each time zone that the events use, once, with the summer and the winter time', () => {
    const zones = calendar.getAllSubcomponents('vtimezone')
    expect(zones).toHaveLength(1)
    expect(zones[0].getFirstPropertyValue('tzid')).toBe('Europe/Rome')
    const standard = zones[0].getAllSubcomponents('standard')
    const daylight = zones[0].getAllSubcomponents('daylight')
    expect(standard.length).toBeGreaterThan(5)
    expect(daylight.length).toBeGreaterThan(5)
    expect(String(standard[1].getFirstPropertyValue('tzoffsetto'))).toBe('+01:00')
    expect(String(daylight[0].getFirstPropertyValue('tzoffsetto'))).toBe('+02:00')
    // The years of the events are covered, and some years after.
    const years = zones[0]
      .getAllSubcomponents()
      .map((observance) => (observance.getFirstPropertyValue('dtstart') as ICAL.Time).year)
    expect(Math.min(...years)).toBeLessThanOrEqual(2025)
    expect(Math.max(...years)).toBeGreaterThanOrEqual(2036)
  })

  it('does not define again a time zone that a part has defined itself', () => {
    const own = part(
      'BEGIN:VTIMEZONE',
      'TZID:Europe/Rome',
      'BEGIN:STANDARD',
      'DTSTART:19701025T030000',
      'TZOFFSETFROM:+0200',
      'TZOFFSETTO:+0100',
      'END:STANDARD',
      'END:VTIMEZONE',
      'BEGIN:VEVENT',
      'UID:own',
      'DTSTAMP:20260101T000000Z',
      'DTSTART;TZID=Europe/Rome:20261112T093000',
      'END:VEVENT',
    )
    const zones = parsed(buildCalendarFile('Own', [own, oneOff])).getAllSubcomponents('vtimezone')
    expect(zones).toHaveLength(1)
    expect(zones[0].getAllSubcomponents('standard')).toHaveLength(1)
  })

  it('leaves a time zone that is not a known one as it is, and does not fail', () => {
    const odd = part(
      'BEGIN:VEVENT',
      'UID:odd',
      'DTSTAMP:20260101T000000Z',
      'DTSTART;TZID=W. Europe Standard Time:20261112T093000',
      'END:VEVENT',
    )
    const result = parsed(buildCalendarFile('Odd', [odd]))
    expect(result.getAllSubcomponents('vtimezone')).toHaveLength(0)
    expect(result.getAllSubcomponents('vevent')).toHaveLength(1)
  })

  it('leaves out a part that cannot be read, and the rest is there', () => {
    const result = parsed(buildCalendarFile('Some', ['nonsense', oneOff]))
    expect(result.getAllSubcomponents('vevent')).toHaveLength(1)
  })
})

describe('the name of the file', () => {
  it('is the name of the calendar, with what a system does not take taken out', () => {
    expect(icsFileName('Personal')).toBe('Personal.ics')
    expect(icsFileName('Work / Team: "A"')).toBe('Work - Team- -A-.ics')
    expect(icsFileName('  .hidden   name  ')).toBe('hidden name.ics')
  })

  it('is calendar.ics when there is no name to use', () => {
    expect(icsFileName('')).toBe('calendar.ics')
    expect(icsFileName('???')).toBe('---.ics')
    expect(icsFileName('   ')).toBe('calendar.ics')
  })
})

describe('the events that the filter lets into the file', () => {
  const titled = (text: string) => {
    const root = emptyFilter()
    return addNode(root, root.id, { ...newRule('title'), operator: 'contains', text })
  }

  it('is all of them when there are no rules, or none that is finished', () => {
    expect(splitByFilter([oneOff, series], emptyFilter())).toEqual({
      included: [oneOff, series],
      left: [],
    })
    expect(splitByFilter([oneOff], titled('')).included).toEqual([oneOff])
  })

  it('leaves out the events that the rules do not let through', () => {
    const { included, left } = splitByFilter([oneOff, series], titled('dentist'))
    expect(included).toEqual([oneOff])
    expect(left).toEqual([series])
  })

  it('lets a series in by its own fields, and its changed days go with it', () => {
    // The title of the changed day says "moved": the series itself does not.
    expect(splitByFilter([series], titled('moved')).included).toEqual([])
    const inAndOut = splitByFilter([series], titled('standup'))
    expect(inAndOut.included).toEqual([series])
    expect(countEvents(inAndOut.included)).toEqual({ events: 1, series: 1, occurrences: 1 })
  })

  it('leaves out what cannot be read, when there are rules, and keeps it when there are none', () => {
    expect(splitByFilter(['nonsense', oneOff], titled('dentist'))).toEqual({
      included: [oneOff],
      left: ['nonsense'],
    })
    expect(splitByFilter(['nonsense'], emptyFilter()).included).toEqual(['nonsense'])
  })
})
