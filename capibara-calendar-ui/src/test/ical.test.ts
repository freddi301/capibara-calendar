import { describe, expect, it } from 'vitest'
import type { EventFields } from '../lib/event-schema'
import {
  buildEvent,
  excludeOccurrence,
  parseEvent,
  parseEvents,
  patchEvent,
  patchOccurrence,
} from '../lib/ical'

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

describe('how an event repeats', () => {
  const calendar = (...lines: string[]) =>
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:r',
      'SUMMARY:Standup',
      'DTSTART:20261102T080000Z',
      ...lines,
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n')
  const repeatOf = (ics: string) => {
    const event = parseEvent(ics, rome)
    return { repeat: event?.repeat, repeatUntil: event?.repeatUntil }
  }

  it('is none for an event that does not', () => {
    expect(repeatOf(calendar())).toEqual({ repeat: undefined, repeatUntil: undefined })
  })

  it('is every day, week, month or year, for ever, or until a day', () => {
    expect(repeatOf(calendar('RRULE:FREQ=DAILY'))).toEqual({ repeat: 'DAILY', repeatUntil: '' })
    expect(repeatOf(calendar('RRULE:FREQ=WEEKLY'))).toEqual({ repeat: 'WEEKLY', repeatUntil: '' })
    expect(repeatOf(calendar('RRULE:FREQ=MONTHLY'))).toEqual({ repeat: 'MONTHLY', repeatUntil: '' })
    expect(repeatOf(calendar('RRULE:FREQ=YEARLY;UNTIL=20271231T225959Z'))).toEqual({
      repeat: 'YEARLY',
      repeatUntil: '2027-12-31', // the last day, in the zone
    })
  })

  it('is custom when it is another rule, which the form cannot say', () => {
    for (const rule of [
      'RRULE:FREQ=MONTHLY;BYMONTHDAY=1,15', // the days of the month
      'RRULE:FREQ=MONTHLY;BYDAY=2TU', // the second Tuesday
      'RRULE:FREQ=WEEKLY;BYDAY=2MO',
      'RRULE:FREQ=DAILY;BYDAY=MO,TU', // days, but not for a repeat every week
      'RRULE:FREQ=YEARLY;BYMONTH=1,6',
      'RRULE:FREQ=DAILY;COUNT=5;UNTIL=20261201T000000Z', // two ends
      'RRULE:FREQ=HOURLY',
    ]) {
      expect(repeatOf(calendar(rule)).repeat, rule).toBe('custom')
    }
  })

  it('is written in the event that is made, with the day it ends on', () => {
    const allDay = buildEvent(
      { ...base, startDate: '2026-11-12', repeat: 'WEEKLY', repeatUntil: '2026-12-31' },
      'abc',
      rome,
    )
    expect(allDay).toContain('RRULE:FREQ=WEEKLY;UNTIL=20261231')
    const timed = buildEvent(
      { ...base, startTime: '09:30', repeat: 'DAILY', repeatUntil: '2026-11-20' },
      'abc',
      rome,
    )
    expect(timed).toContain('RRULE:FREQ=DAILY;UNTIL=20261120T225959Z') // the end of the day in Rome
    expect(buildEvent({ ...base, repeat: 'MONTHLY' }, 'abc', rome)).toContain(
      'RRULE:FREQ=MONTHLY\r\n',
    )
    expect(buildEvent({ ...base, repeat: '' }, 'abc', rome)).not.toContain('RRULE')
    expect(buildEvent(base, 'abc', rome)).not.toContain('RRULE')
  })

  it('goes round: what is made is what is read', () => {
    const ics = buildEvent(
      {
        ...base,
        startTime: '09:30',
        endTime: '10:00',
        repeat: 'WEEKLY',
        repeatUntil: '2026-12-31',
      },
      'abc',
      rome,
    )
    expect(repeatOf(ics)).toEqual({ repeat: 'WEEKLY', repeatUntil: '2026-12-31' })
    const found = parseEvents(ics, rome, { start: '2026-11-01', end: '2027-02-01' })
    expect(found.map(({ startDate }) => startDate)).toEqual([
      '2026-11-12',
      '2026-11-19',
      '2026-11-26',
      '2026-12-03',
      '2026-12-10',
      '2026-12-17',
      '2026-12-24',
      '2026-12-31',
    ])
  })

  it('is changed in the event, or taken away, with what else the event has kept', () => {
    const original = calendar(
      'RRULE:FREQ=WEEKLY',
      'EXDATE:20261109T080000Z',
      'ATTENDEE:mailto:a@example.com',
    )
    const monthly = patchEvent(
      original,
      { ...base, startDate: '2026-11-02', startTime: '09:00', repeat: 'MONTHLY' },
      rome,
    )
    expect(monthly).toContain('FREQ=MONTHLY')
    expect(monthly).not.toContain('FREQ=WEEKLY')
    expect(monthly).toContain('ATTENDEE:mailto:a@example.com')

    const gone = patchEvent(
      original,
      { ...base, startDate: '2026-11-02', startTime: '09:00', repeat: '' },
      rome,
    )
    expect(gone).not.toContain('RRULE')
    expect(gone).not.toContain('EXDATE') // the days that were taken out have nothing to be taken from
  })

  it('is kept as it is when the form does not say, or says custom', () => {
    const original = calendar('RRULE:FREQ=WEEKLY;BYDAY=MO,WE')
    for (const repeat of [undefined, 'custom'] as const) {
      const patched = patchEvent(
        original,
        { ...base, startDate: '2026-11-02', startTime: '09:00', repeat },
        rome,
      )
      expect(patched).toContain('RRULE:FREQ=WEEKLY;BYDAY=MO,WE')
    }
  })

  it('takes away the changes to some of the days, when it does not repeat any more', () => {
    const ics = patchOccurrence(
      calendar('RRULE:FREQ=WEEKLY'),
      '20261109T080000Z',
      { ...base, title: 'Moved', startDate: '2026-11-09', startTime: '10:00' },
      rome,
    )
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2)
    const gone = patchEvent(
      ics,
      { ...base, startDate: '2026-11-02', startTime: '09:00', repeat: '' },
      rome,
    )
    expect(gone.match(/BEGIN:VEVENT/g)).toHaveLength(1)
  })
})

describe('one occurrence of an event that repeats', () => {
  const weekly = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'BEGIN:VEVENT',
    'UID:r',
    'SUMMARY:Standup',
    'DTSTART:20261102T080000Z',
    'DTEND:20261102T083000Z',
    'RRULE:FREQ=WEEKLY',
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
  const range = { start: '2026-11-01', end: '2026-11-30' }
  const found = (ics: string) =>
    parseEvents(ics, rome, range).map(
      ({ title, startDate, startTime }) => `${startDate} ${startTime} ${title}`,
    )

  it('says which one it is, by its start in the repeat', () => {
    const [first, second] = parseEvents(weekly, rome, range)
    expect(first.occurrenceId).toBe('20261102T080000Z')
    expect(second.occurrenceId).toBe('20261109T080000Z')
  })

  it('is changed alone: the others stay as they are', () => {
    const ics = patchOccurrence(
      weekly,
      '20261109T080000Z',
      {
        ...base,
        title: 'Standup, longer',
        startDate: '2026-11-09',
        startTime: '10:00',
        endTime: '11:00',
      },
      rome,
    )

    expect(found(ics)).toEqual([
      '2026-11-02 09:00 Standup',
      '2026-11-09 10:00 Standup, longer',
      '2026-11-16 09:00 Standup',
      '2026-11-23 09:00 Standup',
      '2026-11-30 09:00 Standup',
    ])
    expect(ics).toContain('RECURRENCE-ID:20261109T080000Z')
    expect(ics).toContain('RRULE:FREQ=WEEKLY') // the repeat itself is not touched
    expect(parseEvent(ics, rome)).toMatchObject({ title: 'Standup', startTime: '09:00' }) // the event
  })

  it('can be moved to another day, and the day that it was on is not an occurrence', () => {
    const ics = patchOccurrence(
      weekly,
      '20261109T080000Z',
      { ...base, title: 'Standup', startDate: '2026-11-10', startTime: '09:00' },
      rome,
    )
    expect(found(ics)).toContain('2026-11-10 09:00 Standup')
    expect(found(ics)).not.toContain('2026-11-09 09:00 Standup')
  })

  it('is changed again: the change is replaced, not added to', () => {
    const once = patchOccurrence(
      weekly,
      '20261109T080000Z',
      { ...base, title: 'One', startDate: '2026-11-09', startTime: '10:00' },
      rome,
    )
    const twice = patchOccurrence(
      once,
      '20261109T080000Z',
      { ...base, title: 'Two', startDate: '2026-11-09', startTime: '11:00' },
      rome,
    )

    expect(twice.match(/BEGIN:VEVENT/g)).toHaveLength(2) // the event, and the one change
    expect(found(twice)).toContain('2026-11-09 11:00 Two')
    expect(found(twice).filter((line) => line.includes('2026-11-09'))).toHaveLength(1)
  })

  it('is taken out alone: the others stay, and the change that it had goes', () => {
    const changed = patchOccurrence(
      weekly,
      '20261109T080000Z',
      { ...base, title: 'One', startDate: '2026-11-09', startTime: '10:00' },
      rome,
    )
    const ics = excludeOccurrence(changed, '20261109T080000Z')
    const other = excludeOccurrence(ics, '20261123T080000Z')

    expect(found(other)).toEqual([
      '2026-11-02 09:00 Standup',
      '2026-11-16 09:00 Standup',
      '2026-11-30 09:00 Standup',
    ])
    expect(other.match(/BEGIN:VEVENT/g)).toHaveLength(1) // the change was taken out with its day
    expect(other).toContain('EXDATE:20261109T080000Z')
    expect(other).toContain('RRULE:FREQ=WEEKLY')
  })

  it('keeps the time zone of the repeat, in the change and in the day that is taken out', () => {
    const rome9 = weekly
      .replace('DTSTART:20261102T080000Z', 'DTSTART;TZID=Europe/Rome:20261102T090000')
      .replace('DTEND:20261102T083000Z', 'DTEND;TZID=Europe/Rome:20261102T093000')
    const changed = patchOccurrence(
      rome9,
      '20261109T090000',
      { ...base, title: 'One', startDate: '2026-11-09', startTime: '10:00' },
      rome,
    )
    expect(changed).toContain('RECURRENCE-ID;TZID=Europe/Rome:20261109T090000')
    expect(found(changed)).toContain('2026-11-09 10:00 One')

    const excluded = excludeOccurrence(rome9, '20261116T090000')
    expect(excluded).toContain('EXDATE;TZID=Europe/Rome:20261116T090000')
    expect(found(excluded)).not.toContain('2026-11-16 09:00 Standup')
  })

  it('works for the days of a whole-day event', () => {
    const daily = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:d',
      'SUMMARY:Trip',
      'DTSTART;VALUE=DATE:20261102',
      'RRULE:FREQ=DAILY;COUNT=4',
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n')
    expect(parseEvents(daily, rome, range)[1].occurrenceId).toBe('20261103')

    const excluded = excludeOccurrence(daily, '20261103')
    expect(excluded).toContain('EXDATE;VALUE=DATE:20261103')
    expect(parseEvents(excluded, rome, range).map(({ startDate }) => startDate)).toEqual([
      '2026-11-02',
      '2026-11-04',
      '2026-11-05',
    ])

    const changed = patchOccurrence(
      daily,
      '20261104',
      { ...base, title: 'Trip, late', startDate: '2026-11-04' },
      rome,
    )
    expect(changed).toContain('RECURRENCE-ID;VALUE=DATE:20261104')
    expect(parseEvents(changed, rome, range).map(({ title }) => title)).toEqual([
      'Trip',
      'Trip',
      'Trip, late',
      'Trip',
    ])
  })
})

describe('how often, on which days, and how it ends', () => {
  const calendar = (rule: string) =>
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'BEGIN:VEVENT',
      'UID:r',
      'SUMMARY:Gym',
      'DTSTART:20261102T080000Z',
      rule,
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ].join('\r\n')
  const read = (rule: string) => {
    const event = parseEvent(calendar(rule), rome)
    return {
      repeat: event?.repeat,
      every: event?.repeatInterval,
      days: event?.repeatDays,
      ends: event?.repeatEnds,
      count: event?.repeatCount,
      until: event?.repeatUntil,
    }
  }

  it('is every so many days, weeks, months or years', () => {
    expect(read('RRULE:FREQ=DAILY')).toMatchObject({ repeat: 'DAILY', every: '1' })
    expect(read('RRULE:FREQ=WEEKLY;INTERVAL=2')).toMatchObject({ repeat: 'WEEKLY', every: '2' })
    expect(read('RRULE:FREQ=MONTHLY;INTERVAL=3')).toMatchObject({ repeat: 'MONTHLY', every: '3' })
    expect(read('RRULE:FREQ=YEARLY;INTERVAL=5')).toMatchObject({ repeat: 'YEARLY', every: '5' })
  })

  it('has the days of the week, for a repeat every week', () => {
    expect(read('RRULE:FREQ=WEEKLY;BYDAY=MO,WE,FR')).toMatchObject({
      repeat: 'WEEKLY',
      days: ['MO', 'WE', 'FR'],
    })
    expect(read('RRULE:FREQ=WEEKLY')).toMatchObject({ repeat: 'WEEKLY', days: [] }) // the one of the start
  })

  it('ends never, on a day, or after some times', () => {
    expect(read('RRULE:FREQ=DAILY')).toMatchObject({ ends: 'never', count: '', until: '' })
    expect(read('RRULE:FREQ=DAILY;COUNT=10')).toMatchObject({
      ends: 'after',
      count: '10',
      until: '',
    })
    expect(read('RRULE:FREQ=DAILY;UNTIL=20261130T225959Z')).toMatchObject({
      ends: 'on',
      count: '',
      until: '2026-11-30',
    })
  })

  const make = (fields: object) =>
    buildEvent({ ...base, startDate: '2026-11-02', startTime: '09:00', ...fields }, 'abc', rome)

  it('is written with the interval, the days and how it ends', () => {
    expect(
      make({
        repeat: 'WEEKLY',
        repeatInterval: '2',
        repeatDays: ['MO', 'WE'],
        repeatEnds: 'after',
        repeatCount: '6',
      }),
    ).toContain('RRULE:FREQ=WEEKLY;COUNT=6;INTERVAL=2;BYDAY=MO,WE')
    expect(make({ repeat: 'MONTHLY', repeatInterval: '3' })).toContain(
      'RRULE:FREQ=MONTHLY;INTERVAL=3',
    )
    expect(make({ repeat: 'DAILY', repeatInterval: '1', repeatEnds: 'never' })).toContain(
      'RRULE:FREQ=DAILY\r\n',
    )
  })

  it('does not write days for a repeat that is not every week, nor the ends that are not chosen', () => {
    const ics = make({
      repeat: 'DAILY',
      repeatDays: ['MO'],
      repeatEnds: 'never',
      repeatUntil: '2026-12-31',
      repeatCount: '4',
    })
    expect(ics).toContain('RRULE:FREQ=DAILY\r\n')
    expect(ics).not.toContain('BYDAY')
    expect(ics).not.toContain('UNTIL')
    expect(ics).not.toContain('COUNT')
  })

  it('goes round: every other week on two days, six times, comes back the same', () => {
    const ics = make({
      repeat: 'WEEKLY',
      repeatInterval: '2',
      repeatDays: ['MO', 'WE'],
      repeatEnds: 'after',
      repeatCount: '6',
    })
    expect(parseEvent(ics, rome)).toMatchObject({
      repeat: 'WEEKLY',
      repeatInterval: '2',
      repeatDays: ['MO', 'WE'],
      repeatEnds: 'after',
      repeatCount: '6',
    })
    const days = parseEvents(ics, rome, { start: '2026-11-01', end: '2027-02-28' }).map(
      ({ startDate }) => startDate,
    )
    expect(days).toEqual([
      '2026-11-02',
      '2026-11-04',
      '2026-11-16',
      '2026-11-18',
      '2026-11-30',
      '2026-12-02',
    ])
  })
})
