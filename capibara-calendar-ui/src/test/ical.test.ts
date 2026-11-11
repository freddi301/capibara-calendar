import { describe, expect, it } from 'vitest'
import type { EventFields } from '../lib/event-schema'
import { buildEvent, parseEvent, parseEvents, patchEvent } from '../lib/ical'

// Rome is one hour ahead of UTC in November, and New York is five hours behind.
const rome = 'Europe/Rome'
const newYork = 'America/New_York'

const base: EventFields = {
  title: 'Dentist',
  description: '',
  startDate: '2026-11-12',
  startTime: '',
  endDate: '',
  endTime: '',
}

const roundTrip = (values: EventFields) => {
  const event = parseEvent(buildEvent(values, 'abc', rome), rome)
  if (!event) throw new Error('Not an event')
  const { uid, ...parsed } = event
  expect(uid).toBe('abc')
  return parsed
}

describe('building and reading events', () => {
  it('round-trips a single whole-day event', () => {
    expect(roundTrip(base)).toEqual(base)
  })

  it('round-trips a multi-day whole-day event, with an inclusive last day', () => {
    const values = { ...base, endDate: '2026-11-14' }
    expect(buildEvent(values, 'abc', rome)).toContain('DTEND;VALUE=DATE:20261115')
    expect(roundTrip(values)).toEqual(values)
  })

  it('round-trips an event with only a start time', () => {
    const values = { ...base, startTime: '09:30' }
    expect(buildEvent(values, 'abc', rome)).not.toContain('DTEND')
    expect(roundTrip(values)).toEqual(values)
  })

  it('round-trips an event with a start and an end, across midnight', () => {
    const values = { ...base, startTime: '22:00', endDate: '2026-11-13', endTime: '01:30' }
    expect(roundTrip(values)).toEqual(values)
  })

  it('folds long lines, without splitting a character', () => {
    // Accented letters are 2 bytes and emoji are 4, so folding by bytes could split them.
    const values = {
      ...base,
      title: 'Caffè '.repeat(60) + '🎉'.repeat(30),
      description: 'è'.repeat(200),
    }
    const ics = buildEvent(values, 'abc', rome)

    // ical.js folds by bytes; for plain ASCII its continuation lines are 76 bytes with the space.
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(76)
    }
    expect(ics.split('\r\n').length).toBeGreaterThan(8) // the long text did wrap
    expect(roundTrip(values)).toEqual(values)
  })

  it('keeps commas, semicolons, backslashes and new lines in text', () => {
    // "c\nd" with a real backslash: it must not come back as a new line.
    const values = { ...base, title: 'a, b; c\\nd', description: 'line 1\nline 2' }
    expect(roundTrip(values)).toEqual(values)
  })
})

describe('time zones', () => {
  const timed = { ...base, startTime: '09:30', endTime: '10:30' }

  it('writes timed events in UTC, from the wall clock of the chosen zone', () => {
    expect(buildEvent(timed, 'abc', rome)).toContain('DTSTART:20261112T083000Z')
    expect(buildEvent(timed, 'abc', newYork)).toContain('DTSTART:20261112T143000Z')
    expect(buildEvent(timed, 'abc', rome)).toContain('DTEND:20261112T093000Z')
  })

  it('shows the same event at the local time of the zone it is read in', () => {
    const ics = buildEvent(timed, 'abc', rome) // 09:30 in Rome
    expect(parseEvent(ics, rome)).toMatchObject({ startDate: '2026-11-12', startTime: '09:30' })
    expect(parseEvent(ics, newYork)).toMatchObject({ startDate: '2026-11-12', startTime: '03:30' })
  })

  it('can move an event to another day, when the zone is on the other side of midnight', () => {
    const late = buildEvent({ ...base, startTime: '23:30', endTime: '23:45' }, 'abc', rome)
    // 23:30 in Rome is 22:30 UTC, and already the next morning in Auckland (UTC+13 in November).
    expect(parseEvent(late, 'Pacific/Auckland')).toMatchObject({
      startDate: '2026-11-13',
      startTime: '11:30',
    })
  })

  it('does not move whole-day events, whatever the zone is', () => {
    const ics = buildEvent({ ...base, endDate: '2026-11-14' }, 'abc', rome)
    expect(parseEvent(ics, 'Pacific/Auckland')).toMatchObject({
      startDate: '2026-11-12',
      endDate: '2026-11-14',
    })
  })
})

describe('reading events from other apps', () => {
  const wrap = (lines: string) =>
    `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:x\r\nSUMMARY:S\r\n${lines}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`

  it('converts UTC times to the zone', () => {
    const lines = 'DTSTART:20261112T083000Z\r\nDTEND:20261112T093000Z'
    expect(parseEvent(wrap(lines), rome)).toMatchObject({ startTime: '09:30', endTime: '10:30' })
    expect(parseEvent(wrap(lines), newYork)).toMatchObject({ startTime: '03:30', endTime: '04:30' })
  })

  it('converts times with a time zone to the zone', () => {
    // 09:30 in Rome is 08:30 UTC and 03:30 in New York in November.
    const ics = wrap('DTSTART;TZID=Europe/Rome:20261112T093000')
    expect(parseEvent(ics, rome)?.startTime).toBe('09:30')
    expect(parseEvent(ics, newYork)?.startTime).toBe('03:30')
  })

  it('reads times without a time zone as written, in any zone', () => {
    const ics = wrap('DTSTART:20261112T093000')
    expect(parseEvent(ics, rome)).toMatchObject({ startDate: '2026-11-12', startTime: '09:30' })
    expect(parseEvent(ics, newYork)).toMatchObject({ startDate: '2026-11-12', startTime: '09:30' })
  })

  it('keeps the time as written for a time zone it does not know', () => {
    const ics = wrap('DTSTART;TZID=Nowhere/Land:20261112T093000')
    expect(parseEvent(ics, rome)?.startTime).toBe('09:30')
  })

  it('ignores things that are not events', () => {
    const todo =
      'BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nUID:t\r\nSUMMARY:S\r\nDTSTART:20261112\r\nEND:VTODO\r\nEND:VCALENDAR\r\n'
    expect(parseEvent(todo, rome)).toBeUndefined()
    expect(parseEvent(wrap(''), rome)).toBeUndefined() // no DTSTART
  })

  it('does not mistake an alarm description for the event description', () => {
    const alarm =
      'BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Alarm text\r\nTRIGGER:-PT15M\r\nEND:VALARM'
    expect(parseEvent(wrap(`DTSTART;VALUE=DATE:20261112\r\n${alarm}`), rome)?.description).toBe('')
  })
})

describe('patching an existing event', () => {
  const original = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:x',
    'SUMMARY:Old title',
    'DESCRIPTION:Old description',
    'DTSTART;VALUE=DATE:20261112',
    'ATTENDEE:mailto:a@example.com',
    'RRULE:FREQ=WEEKLY',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Alarm text',
    'TRIGGER:-PT15M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')

  it('changes what the form edits and keeps everything else', () => {
    const patched = patchEvent(
      original,
      { ...base, title: 'New title', description: '', startTime: '09:30' },
      rome,
    )

    expect(parseEvent(patched, rome)).toMatchObject({
      uid: 'x',
      title: 'New title',
      startTime: '09:30',
    })
    expect(patched).toContain('DTSTART:20261112T083000Z') // written from the wall clock of Rome
    expect(patched).not.toContain('Old title')
    expect(patched).not.toContain('Old description')
    expect(patched).not.toContain('VALUE=DATE')
    expect(patched).toContain('ATTENDEE:mailto:a@example.com')
    expect(patched).toContain('RRULE:FREQ=WEEKLY')
    expect(patched).toContain('DESCRIPTION:Alarm text') // the alarm's own description
  })
})

describe('repeated events', () => {
  const calendar = (...events: string[]) =>
    ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events, 'END:VCALENDAR', ''].join('\r\n')
  const vevent = (...lines: string[]) =>
    ['BEGIN:VEVENT', 'UID:r', 'SUMMARY:Standup', ...lines, 'END:VEVENT'].join('\r\n')
  const occurrences = (ics: string, start: string, end: string, zone = rome) =>
    parseEvents(ics, zone, { start, end })
  const dates = (ics: string, start: string, end: string, zone = rome) =>
    occurrences(ics, start, end, zone).map(({ startDate, startTime }) =>
      startTime ? `${startDate} ${startTime}` : startDate,
    )

  const weekly = calendar(
    vevent('DTSTART:20261102T080000Z', 'DTEND:20261102T083000Z', 'RRULE:FREQ=WEEKLY'),
  )

  it('has an occurrence for each day of the repeat that is in the range', () => {
    expect(dates(weekly, '2026-11-10', '2026-11-24')).toEqual([
      '2026-11-16 09:00',
      '2026-11-23 09:00',
    ])
    expect(occurrences(weekly, '2026-11-10', '2026-11-24')[0]).toMatchObject({
      uid: 'r',
      title: 'Standup',
      endDate: '2026-11-16',
      endTime: '09:30',
      isRecurring: true,
    })
  })

  it('has the first occurrence, and the ones that end after the range starts', () => {
    expect(dates(weekly, '2026-11-02', '2026-11-02')).toEqual(['2026-11-02 09:00'])
    const trip = calendar(
      vevent('DTSTART;VALUE=DATE:20261105', 'DTEND;VALUE=DATE:20261108', 'RRULE:FREQ=MONTHLY'),
    )
    // The trip of December runs from the 5th to the 7th: it is in a range that starts on the 7th.
    expect(dates(trip, '2026-12-07', '2026-12-08')).toEqual(['2026-12-05'])
    expect(occurrences(trip, '2026-12-07', '2026-12-08')[0]).toMatchObject({
      endDate: '2026-12-07',
    })
  })

  it('stops with the count and with the until date', () => {
    const counted = calendar(vevent('DTSTART;VALUE=DATE:20261102', 'RRULE:FREQ=DAILY;COUNT=3'))
    expect(dates(counted, '2026-11-01', '2026-12-31')).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ])
    const until = calendar(vevent('DTSTART;VALUE=DATE:20261102', 'RRULE:FREQ=DAILY;UNTIL=20261103'))
    expect(dates(until, '2026-11-01', '2026-12-31')).toEqual(['2026-11-02', '2026-11-03'])
  })

  it('does not have the days that were taken out of the repeat', () => {
    const ics = calendar(
      vevent(
        'DTSTART;VALUE=DATE:20261102',
        'RRULE:FREQ=DAILY;COUNT=4',
        'EXDATE;VALUE=DATE:20261103',
      ),
    )
    expect(dates(ics, '2026-11-01', '2026-11-30')).toEqual([
      '2026-11-02',
      '2026-11-04',
      '2026-11-05',
    ])
  })

  it('has the change that was made to one of the days', () => {
    const ics = calendar(
      vevent('DTSTART:20261102T080000Z', 'DTEND:20261102T083000Z', 'RRULE:FREQ=WEEKLY'),
      [
        'BEGIN:VEVENT',
        'UID:r',
        'RECURRENCE-ID:20261109T080000Z',
        'SUMMARY:Standup, longer',
        'DTSTART:20261109T090000Z',
        'DTEND:20261109T100000Z',
        'END:VEVENT',
      ].join('\r\n'),
    )
    const found = occurrences(ics, '2026-11-01', '2026-11-16')
    expect(found.map(({ title }) => title)).toEqual(['Standup', 'Standup, longer', 'Standup'])
    expect(found[1]).toMatchObject({ startTime: '10:00', endTime: '11:00' })
  })

  it('shows the time at the local time of the zone, and the day it falls on', () => {
    const ics = calendar(
      vevent('DTSTART;TZID=Europe/Rome:20261102T233000', 'RRULE:FREQ=WEEKLY;COUNT=2'),
    )
    expect(dates(ics, '2026-11-01', '2026-11-30')).toEqual(['2026-11-02 23:30', '2026-11-09 23:30'])
    expect(dates(ics, '2026-11-01', '2026-11-30', newYork)).toEqual([
      '2026-11-02 17:30',
      '2026-11-09 17:30',
    ])
  })

  it('has the details of the event, not of the alarms, when it is the first one in the object', () => {
    const exception = [
      'BEGIN:VEVENT',
      'UID:r',
      'RECURRENCE-ID:20261109T080000Z',
      'SUMMARY:Moved',
      'DTSTART:20261109T080000Z',
      'END:VEVENT',
    ].join('\r\n')
    const ics = calendar(exception, vevent('DTSTART:20261102T080000Z', 'RRULE:FREQ=WEEKLY'))
    expect(parseEvent(ics, rome)).toMatchObject({ title: 'Standup', startDate: '2026-11-02' })
    expect(occurrences(ics, '2026-11-01', '2026-11-16').map(({ title }) => title)).toEqual([
      'Standup',
      'Moved',
      'Standup',
    ])
  })

  it('has one event that is not repeated, and none that are not valid', () => {
    const single = calendar(vevent('DTSTART;VALUE=DATE:20261112'))
    expect(dates(single, '2026-11-01', '2026-11-30')).toEqual(['2026-11-12'])
    expect(occurrences(single, '2026-11-01', '2026-11-30')[0]?.isRecurring).toBeUndefined()
    expect(occurrences('not iCalendar', '2026-11-01', '2026-11-30')).toEqual([])
    expect(occurrences(calendar(vevent('RRULE:FREQ=DAILY')), '2026-11-01', '2026-11-30')).toEqual(
      [],
    )
  })

  it('does not run forever for a repeat without an end', () => {
    const daily = calendar(vevent('DTSTART;VALUE=DATE:19000101', 'RRULE:FREQ=DAILY'))
    expect(dates(daily, '2026-11-12', '2026-11-14')).toEqual([]) // too far from the start: given up
  })
})
