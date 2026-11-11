import { describe, expect, it } from 'vitest'
import type { EventFields } from '../lib/event-schema'
import { buildEvent, parseEvent, patchEvent } from '../lib/ical'

const base: EventFields = {
  title: 'Dentist',
  description: '',
  startDate: '2026-11-12',
  startTime: '',
  endDate: '',
  endTime: '',
}

const roundTrip = (values: EventFields) => {
  const event = parseEvent(buildEvent(values, 'abc'))
  if (!event) throw new Error('Not an event')
  const { uid, ...parsed } = event
  expect(uid).toBe('abc')
  return parsed
}

/** The local date and time of an instant, in the time zone the app runs in. */
const local = (instant: string) =>
  Temporal.Instant.from(instant).toZonedDateTimeISO(Temporal.Now.timeZoneId()).toPlainDateTime()

describe('building and reading events', () => {
  it('round-trips a single whole-day event', () => {
    expect(roundTrip(base)).toEqual(base)
  })

  it('round-trips a multi-day whole-day event, with an inclusive last day', () => {
    const values = { ...base, endDate: '2026-11-14' }
    expect(buildEvent(values, 'abc')).toContain('DTEND;VALUE=DATE:20261115')
    expect(roundTrip(values)).toEqual(values)
  })

  it('round-trips an event with only a start time', () => {
    const values = { ...base, startTime: '09:30' }
    expect(buildEvent(values, 'abc')).not.toContain('DTEND')
    expect(roundTrip(values)).toEqual(values)
  })

  it('round-trips an event with a start and an end, across midnight', () => {
    const values = { ...base, startTime: '22:00', endDate: '2026-11-13', endTime: '01:30' }
    expect(roundTrip(values)).toEqual(values)
  })

  it('writes timed events in UTC', () => {
    expect(buildEvent({ ...base, startTime: '09:30' }, 'abc')).toMatch(/DTSTART:\d{8}T\d{6}Z/)
  })

  it('folds long lines, without splitting a character', () => {
    // Accented letters are 2 bytes and emoji are 4, so folding by bytes could split them.
    const values = {
      ...base,
      title: 'Caffè '.repeat(60) + '🎉'.repeat(30),
      description: 'è'.repeat(200),
    }
    const ics = buildEvent(values, 'abc')

    // ical.js folds by bytes; for plain ASCII its continuation lines are 76 bytes with the space.
    for (const line of ics.split('\r\n')) {
      expect(new TextEncoder().encode(line).length).toBeLessThanOrEqual(76)
    }
    expect(ics.split('\r\n').length).toBeGreaterThan(8) // the long text did wrap
    expect(roundTrip(values)).toEqual(values)
  })

  it('keeps commas, semicolons, backslashes and new lines in text', () => {
    const values = { ...base, title: 'a, b; c\\d', description: 'line 1\nline 2' }
    expect(roundTrip(values)).toEqual(values)
  })
})

describe('reading events from other apps', () => {
  const wrap = (lines: string) =>
    `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:x\r\nSUMMARY:S\r\n${lines}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`

  it('converts UTC times to local time', () => {
    const event = parseEvent(wrap('DTSTART:20261112T083000Z\r\nDTEND:20261112T093000Z'))
    const start = local('2026-11-12T08:30:00Z')
    expect(event?.startDate).toBe(start.toPlainDate().toString())
    expect(event?.startTime).toBe(start.toPlainTime().toString({ smallestUnit: 'minute' }))
  })

  it('converts times with a time zone to local time', () => {
    const event = parseEvent(wrap('DTSTART;TZID=Europe/Rome:20261112T093000'))
    const start = local('2026-11-12T08:30:00Z') // 09:30 in Rome is 08:30 UTC in November
    expect(event?.startTime).toBe(start.toPlainTime().toString({ smallestUnit: 'minute' }))
  })

  it('reads times without a time zone as written', () => {
    expect(parseEvent(wrap('DTSTART:20261112T093000'))).toMatchObject({
      startDate: '2026-11-12',
      startTime: '09:30',
    })
  })

  it('ignores things that are not events', () => {
    const todo =
      'BEGIN:VCALENDAR\r\nBEGIN:VTODO\r\nUID:t\r\nSUMMARY:S\r\nDTSTART:20261112\r\nEND:VTODO\r\nEND:VCALENDAR\r\n'
    expect(parseEvent(todo)).toBeUndefined()
    expect(parseEvent(wrap(''))).toBeUndefined() // no DTSTART
  })

  it('does not mistake an alarm description for the event description', () => {
    const alarm =
      'BEGIN:VALARM\r\nACTION:DISPLAY\r\nDESCRIPTION:Alarm text\r\nTRIGGER:-PT15M\r\nEND:VALARM'
    expect(parseEvent(wrap(`DTSTART;VALUE=DATE:20261112\r\n${alarm}`))?.description).toBe('')
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
    const patched = patchEvent(original, {
      ...base,
      title: 'New title',
      description: '',
      startTime: '09:30',
    })

    expect(parseEvent(patched)).toMatchObject({ uid: 'x', title: 'New title', startTime: '09:30' })
    expect(patched).not.toContain('Old title')
    expect(patched).not.toContain('Old description')
    expect(patched).not.toContain('VALUE=DATE')
    expect(patched).toContain('ATTENDEE:mailto:a@example.com')
    expect(patched).toContain('RRULE:FREQ=WEEKLY')
    expect(patched).toContain('DESCRIPTION:Alarm text') // the alarm's own description
  })
})
