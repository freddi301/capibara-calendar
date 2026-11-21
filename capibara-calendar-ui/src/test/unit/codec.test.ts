import { expect, it } from 'vitest'
import { contactId, duration, localDateTime, signedDuration, timeZoneId } from '@/api/calendar-api'
import { decode, encode } from '@/api/caldav/codec'
import { eventValues } from '@/test/support/contract'

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

it('reads the GEO of an event as the coordinates of its place, with or without a location', () => {
  // given
  const located = wrap(
    'SUMMARY:Party\r\nDTSTART:20261112T120000Z\r\nLOCATION:Villa\r\nGEO:44.38;9.04',
  )
  const onlyGeo = wrap('SUMMARY:Party\r\nDTSTART:20261112T120000Z\r\nGEO:-33.8688;151.2093')
  const noGeo = wrap('SUMMARY:Party\r\nDTSTART:20261112T120000Z\r\nLOCATION:Villa')

  // then
  expect(decode(located)?.event.locations).toEqual([
    { name: 'Villa', coordinates: { latitude: 44.38, longitude: 9.04 } },
  ])
  expect(decode(onlyGeo)?.event.locations).toEqual([
    { name: '', coordinates: { latitude: -33.8688, longitude: 151.2093 } },
  ])
  expect(decode(noGeo)?.event.locations).toEqual([{ name: 'Villa' }])
})

it('writes the GEO when the coordinates change, and leaves it as it is when they do not', () => {
  // given
  const original = wrap(
    'SUMMARY:Party\r\nDTSTART:20261112T120000Z\r\nLOCATION:Villa\r\nGEO:44.38221763037996;9.04328792627319',
  )
  const resource = decode(original)
  if (!resource) throw new Error('Not read')
  const withPlace = (place: {
    name: string
    coordinates?: { latitude: number; longitude: number }
  }) => encode({ ...resource, event: { ...resource.event, locations: [place] } }, original)

  // when
  const renamed = withPlace({ ...resource.event.locations[0], name: 'Villa Groppallo' })
  const moved = withPlace({ name: 'Villa', coordinates: { latitude: 45.46, longitude: 9.19 } })
  const cleared = withPlace({ name: 'Villa' })

  // then
  expect(renamed).toContain('LOCATION:Villa Groppallo')
  expect(renamed).toContain('GEO:44.38221763037996;9.04328792627319') // all its digits
  expect(moved).toContain('GEO:45.46;9.19')
  expect(moved).not.toContain('44.38221763037996')
  expect(cleared).not.toContain('GEO')
  expect(decode(moved)?.event.locations).toEqual([
    { name: 'Villa', coordinates: { latitude: 45.46, longitude: 9.19 } },
  ])
})

it('writes the GEO of an event that has coordinates and no name, and none when it has no place at all', () => {
  // given
  const original = wrap('SUMMARY:Party\r\nDTSTART:20261112T120000Z\r\nGEO:44.38;9.04')
  const resource = decode(original)
  if (!resource) throw new Error('Not read')

  // when
  const kept = encode(resource, original)
  const removed = encode({ ...resource, event: { ...resource.event, locations: [] } }, original)

  // then
  expect(kept).toContain('GEO:44.38;9.04')
  expect(kept).not.toContain('LOCATION')
  expect(removed).not.toContain('GEO')
})

it('reads the end in its own zone when DTEND has another TZID than DTSTART, with the time that passes between them', () => {
  // given
  const read = (body: string) => decode(wrap(`SUMMARY:Flight\r\n${body}`))?.event

  // when
  const flight = read(
    'DTSTART;TZID=Europe/Rome:20261112T100000\r\nDTEND;TZID=America/New_York:20261112T123000',
  )
  const toUtc = read('DTSTART;TZID=Europe/Rome:20261112T100000\r\nDTEND:20261112T170000Z')

  // then: 10:00 in Rome is 09:00 in UTC, and 12:30 in New York is 17:30
  expect(flight).toMatchObject({
    start: '2026-11-12T10:00:00',
    timeZone: 'Europe/Rome',
    endTimeZone: 'America/New_York',
    duration: 'PT8H30M',
  })
  expect(toUtc).toMatchObject({ timeZone: 'Europe/Rome', endTimeZone: 'UTC', duration: 'PT8H' })
})

it('has no zone for the end when DTEND is in the zone of DTSTART, or the event is floating, or all day', () => {
  // given
  const read = (body: string) => decode(wrap(`SUMMARY:E\r\n${body}`))?.event

  // when
  const same = read(
    'DTSTART;TZID=Europe/Rome:20261112T100000\r\nDTEND;TZID=Europe/Rome:20261112T110000',
  )
  const floating = read('DTSTART:20261112T100000\r\nDTEND:20261112T110000')
  const allDay = read('DTSTART;VALUE=DATE:20261114\r\nDTEND;VALUE=DATE:20261117')

  // then
  expect(same?.endTimeZone).toBeNull()
  expect(floating?.endTimeZone).toBeNull()
  expect(allDay?.endTimeZone).toBeNull()
})

it('writes DTEND in its own zone, and reads the same event back', () => {
  // given
  const event = eventValues({
    start: localDateTime('2026-11-12T10:00:00'),
    timeZone: timeZoneId('Europe/Rome'),
    endTimeZone: timeZoneId('America/New_York'),
    duration: duration('PT8H30M'),
  })

  // when
  const ics = encode({ uid: 'abc', event, recurrenceOverrides: {} })

  // then
  expect(ics).toContain('DTSTART;TZID=Europe/Rome:20261112T100000')
  expect(ics).toContain('DTEND;TZID=America/New_York:20261112T123000')
  expect(decode(ics)?.event).toEqual(event)
})

it('keeps the zone of the end when an event that came from another app is written again', () => {
  // given
  const original = wrap(
    'SUMMARY:Flight\r\nDTSTART;TZID=Europe/Rome:20261112T100000\r\nDTEND;TZID=America/New_York:20261112T123000',
  )
  const resource = decode(original)
  if (!resource) throw new Error('Not read')

  // when
  const ics = encode(
    { ...resource, event: { ...resource.event, title: 'Flight, renamed' } },
    original,
  )

  // then
  expect(ics).toContain('DTEND;TZID=America/New_York:20261112T123000')
  expect(decode(ics)?.event).toMatchObject({
    title: 'Flight, renamed',
    endTimeZone: 'America/New_York',
  })
})
