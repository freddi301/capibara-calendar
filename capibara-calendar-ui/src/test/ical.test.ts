import { describe, expect, it } from 'vitest'
import type { EventFields } from '../lib/event-schema'
import { buildEvent, parseEvent, patchEvent } from '../lib/ical'

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
