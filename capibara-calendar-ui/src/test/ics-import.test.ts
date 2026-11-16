import { describe, expect, it } from 'vitest'
import { addNode, emptyFilter, newRule } from '../lib/event-filter'
import { parseCalendarFile, planImport, totalsOf } from '../lib/ics-import'

const calendar = (...lines: string[]) =>
  ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//x//EN', ...lines, 'END:VCALENDAR', ''].join('\r\n')

const event = (uid: string, title: string, ...more: string[]) => [
  'BEGIN:VEVENT',
  `UID:${uid}`,
  'DTSTAMP:20260101T000000Z',
  `SUMMARY:${title}`,
  'DTSTART:20261112T093000Z',
  ...more,
  'END:VEVENT',
]

describe('the events of a file', () => {
  it('are one for each UID, and a series has its changed days together with it', () => {
    const file = calendar(
      ...event('a', 'Dentist'),
      ...event('weekly', 'Standup', 'RRULE:FREQ=WEEKLY'),
      'BEGIN:VEVENT',
      'UID:weekly',
      'DTSTAMP:20260101T000000Z',
      'RECURRENCE-ID:20261119T093000Z',
      'SUMMARY:Standup (moved)',
      'DTSTART:20261119T100000Z',
      'END:VEVENT',
    )
    const { events, skipped, problems } = parseCalendarFile(file)
    expect(events.map(({ uid, occurrences }) => [uid, occurrences])).toEqual([
      ['a', 0],
      ['weekly', 1],
    ])
    expect(skipped).toBe(0)
    expect(problems).toEqual([])
  })

  it('leave out what is not an event, and say what could not be read', () => {
    const file = calendar(
      ...event('a', 'Dentist'),
      'BEGIN:VTODO',
      'UID:todo',
      'DTSTAMP:20260101T000000Z',
      'SUMMARY:Buy milk',
      'END:VTODO',
      'BEGIN:VEVENT',
      'DTSTAMP:20260101T000000Z',
      'SUMMARY:No UID',
      'DTSTART:20261112T093000Z',
      'END:VEVENT',
    )
    const parsed = parseCalendarFile(file)
    expect(parsed.events).toHaveLength(1)
    expect(parsed.skipped).toBe(1)
    expect(parsed.problems).toEqual([{ kind: 'no-uid' }])
  })

  it('say that the file is not a calendar, when it is not', () => {
    expect(parseCalendarFile('hello').problems).toEqual([{ kind: 'file' }])
  })

  it('keep the properties that start with X-', () => {
    const { events } = parseCalendarFile(calendar(...event('a', 'Dentist', 'X-KEPT:as it was')))
    expect(events[0].resource.extra).toEqual(['X-KEPT:as it was'])
  })
})

describe('what importing does with each event', () => {
  const incomingOf = (...lines: string[]) => parseCalendarFile(calendar(...lines)).events
  const decisions = (
    incoming: ReturnType<typeof incomingOf>,
    there: string[],
    filter = emptyFilter(),
  ) => planImport(incoming, there, filter).map(({ decision }) => decision)

  it('is new when the calendar has no event with the UID', () => {
    expect(decisions(incomingOf(...event('a', 'Dentist')), [])).toEqual(['new'])
  })

  it('leaves as it is an event that is the same, or is older, and replaces one that is newer', () => {
    const there = calendar(...event('a', 'Dentist', 'SEQUENCE:2'))
    // The same.
    expect(decisions(incomingOf(...event('a', 'Dentist', 'SEQUENCE:2')), [there])).toEqual([
      'current',
    ])
    // Another, with a lower sequence: older.
    expect(decisions(incomingOf(...event('a', 'Dentist 1', 'SEQUENCE:1')), [there])).toEqual([
      'current',
    ])
    // Another, with a higher sequence: newer.
    expect(decisions(incomingOf(...event('a', 'Dentist 3', 'SEQUENCE:3')), [there])).toEqual([
      'update',
    ])
  })

  it('goes by when it was changed when the sequence is the same', () => {
    const there = calendar(...event('a', 'Dentist', 'SEQUENCE:1', 'LAST-MODIFIED:20260201T000000Z'))
    const later = incomingOf(
      ...event('a', 'Dentist later', 'SEQUENCE:1', 'LAST-MODIFIED:20260301T000000Z'),
    )
    const earlier = incomingOf(
      ...event('a', 'Dentist earlier', 'SEQUENCE:1', 'LAST-MODIFIED:20260101T000000Z'),
    )
    expect(decisions(later, [there])).toEqual(['update'])
    expect(decisions(earlier, [there])).toEqual(['current'])
  })

  it('picks the same one for everybody when the sequence and the time are the same', () => {
    const one = calendar(...event('a', 'Alpha', 'SEQUENCE:1'))
    const other = calendar(...event('a', 'Beta', 'SEQUENCE:1'))
    const first = decisions(incomingOf(...event('a', 'Alpha', 'SEQUENCE:1')), [other])[0]
    const second = decisions(incomingOf(...event('a', 'Beta', 'SEQUENCE:1')), [one])[0]
    expect([first, second].sort()).toEqual(['current', 'update'])
  })

  it('ignores what the filter does not let through, and counts the changed days of each', () => {
    const root = emptyFilter()
    const rules = addNode(root, root.id, {
      ...newRule('title'),
      operator: 'contains',
      text: 'dent',
    })
    const incoming = incomingOf(...event('a', 'Dentist'), ...event('b', 'Lunch'))
    const planned = planImport(incoming, [], rules)
    expect(planned.map(({ decision }) => decision)).toEqual(['new', 'ignored'])
    expect(totalsOf(planned)).toMatchObject({
      new: { events: 1, occurrences: 0 },
      ignored: { events: 1, occurrences: 0 },
      update: { events: 0 },
    })
  })
})
