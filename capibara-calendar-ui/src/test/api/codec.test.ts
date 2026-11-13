import { expect, it } from 'vitest'
import {
  contactId,
  duration,
  localDateTime,
  signedDuration,
  timeZoneId,
} from '../../api/calendar-api'
import { decode, encode } from '../../api/caldav/codec'
import { eventValues } from './contract'

const wrap = (body: string) =>
  `BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//other//EN\r\nBEGIN:VEVENT\r\nUID:abc\r\n${body}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`

it('reads the times of an event as they are written: in a zone, in UTC, floating, or of whole days', () => {
  const read = (body: string) => decode(wrap(`SUMMARY:E\r\n${body}`))?.event

  expect(
    read('DTSTART;TZID=Europe/Rome:20261112T093000\r\nDTEND;TZID=Europe/Rome:20261112T110000'),
  ).toMatchObject({
    start: '2026-11-12T09:30:00',
    timeZone: 'Europe/Rome',
    duration: 'PT1H30M',
    showWithoutTime: false,
  })
  expect(read('DTSTART:20261112T083000Z')).toMatchObject({
    start: '2026-11-12T08:30:00',
    timeZone: 'UTC',
    duration: 'PT0S',
  })
  expect(read('DTSTART:20261112T093000')).toMatchObject({ timeZone: null })
  expect(read('DTSTART;VALUE=DATE:20261114\r\nDTEND;VALUE=DATE:20261117')).toMatchObject({
    showWithoutTime: true,
    start: '2026-11-14T00:00:00',
    duration: 'P3D',
  })
})

it('writes what it reads: the zone, the details, the alerts and the repeat, with the changes of an occurrence', () => {
  const event = eventValues({
    title: 'Standup',
    description: 'Daily',
    timeZone: timeZoneId('America/New_York'),
    locations: [{ name: 'Room 4' }],
    virtualLocations: [{ uri: 'https://meet.example.org/x' }],
    keywords: ['team', 'weekly'],
    alerts: [
      { trigger: { type: 'offset', offset: signedDuration('-PT15M'), relativeTo: 'start' } },
    ],
    recurrenceRules: [
      {
        frequency: 'weekly',
        interval: 2,
        byDay: [{ day: 'mo' }, { day: 'th' }],
        until: localDateTime('2026-12-31T09:00:00'),
      },
    ],
  })
  const overrides = {
    [localDateTime('2026-11-26T09:00:00')]: { excluded: true as const },
    [localDateTime('2026-11-16T09:00:00')]: {
      ...event,
      title: 'Standup, moved',
      start: localDateTime('2026-11-16T11:00:00'),
      recurrenceRules: [],
    },
  }

  const ics = encode({ uid: 'abc', event, recurrenceOverrides: overrides })
  const back = decode(ics)

  expect(ics).toContain('TZID=America/New_York')
  expect(back?.event).toEqual(event)
  expect(back?.recurrenceOverrides).toEqual(overrides)
})

it('keeps what it does not know when an event that came from another app is written again', () => {
  const original = wrap(
    'SUMMARY:Lunch\r\nDTSTART;TZID=Europe/Rome:20261112T120000\r\nDTEND;TZID=Europe/Rome:20261112T130000\r\nATTENDEE:mailto:sam@example.org\r\nX-CUSTOM:keep me',
  )
  const resource = decode(original)
  if (!resource) throw new Error('Not read')

  const ics = encode(
    {
      ...resource,
      event: { ...resource.event, title: 'Lunch, later', duration: duration('PT2H') },
    },
    original,
  )

  expect(ics).toContain('ATTENDEE:mailto:sam@example.org')
  expect(ics).toContain('X-CUSTOM:keep me')
  expect(decode(ics)?.event).toMatchObject({ title: 'Lunch, later', duration: 'PT2H' })
})

it('reads and writes the status and the color of an event, and writes none for a confirmed one', () => {
  const original = wrap(
    'SUMMARY:Lunch\r\nDTSTART:20261112T120000Z\r\nSTATUS:CANCELLED\r\nCOLOR:hotpink',
  )
  const resource = decode(original)
  if (!resource) throw new Error('Not read')
  expect(resource.event.status).toBe('cancelled')
  expect(resource.event.color).toBe('hotpink')

  const tentative = encode(
    { ...resource, event: { ...resource.event, status: 'tentative' } },
    original,
  )
  expect(tentative).toContain('STATUS:TENTATIVE')
  const confirmed = encode(
    { ...resource, event: { ...resource.event, status: 'confirmed' } },
    original,
  )
  expect(confirmed).not.toContain('STATUS')
  expect(decode(confirmed)?.event.status).toBe('confirmed')
  const plain = encode({ ...resource, event: { ...resource.event, color: null } }, original)
  expect(plain).not.toContain('COLOR')
})

it('reads the attendees and the organizer, and changes only the answers and the list, not the rest of a line', () => {
  const original = wrap(
    [
      'SUMMARY:Planning',
      'DTSTART:20261112T120000Z',
      'ORGANIZER;CN=Ada:mailto:ada@example.org',
      'ATTENDEE;CN=Sam;ROLE=OPT-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE:mailto:sam@example.org',
      'ATTENDEE;CN=Eve:mailto:eve@example.org',
    ].join('\r\n'),
  )
  const resource = decode(original)
  if (!resource) throw new Error('Not read')
  expect(resource.event.organizer).toBe('mailto:ada@example.org')
  expect(resource.event.participants).toEqual([
    { id: 'mailto:sam@example.org', status: 'accepted' },
    { id: 'mailto:eve@example.org', status: 'needs-action' },
  ])

  const ics = encode(
    {
      ...resource,
      event: {
        ...resource.event,
        participants: [
          { id: contactId('mailto:sam@example.org'), status: 'declined' },
          { id: contactId('urn:uuid:5b1c'), status: 'needs-action' },
        ],
      },
    },
    original,
  )

  expect(ics).toContain('ROLE=OPT-PARTICIPANT') // what is not ours stays on the line
  expect(ics).toContain('RSVP=TRUE')
  expect(ics).toContain('CN=Sam')
  expect(ics).toContain('ORGANIZER;CN=Ada:mailto:ada@example.org')
  expect(ics).not.toContain('eve@example.org') // the one that was taken out
  expect(ics).toContain('urn:uuid:5b1c') // the one that was added: its address and nothing more
  expect(ics).toContain('SCHEDULE-AGENT=NONE')
  expect(decode(ics)?.event.participants).toEqual([
    { id: 'mailto:sam@example.org', status: 'declined' },
    { id: 'urn:uuid:5b1c', status: 'needs-action' },
  ])
})
