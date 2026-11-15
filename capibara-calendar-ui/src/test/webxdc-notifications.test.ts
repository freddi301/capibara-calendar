import { expect, it } from 'vitest'
import {
  calendarId,
  contactId,
  duration,
  eventId,
  localDateTime,
  sourceId,
  type EventValues,
  type Participant,
} from '../api/calendar-api'
import { notificationsOf, type ChatChange } from '../api/webxdc/notifications'
import type { StoredCalendar, StoredEvent } from '../api/stored-documents'
import { eventValues } from './api/contract'

// The people of the chat: Ada is the author, Bruno and Carla are the others. The events are in Rome.
const context = {
  author: 'Ada',
  people: new Map([
    ['ada', 'Ada'],
    ['bruno', 'Bruno'],
    ['carla', 'Carla'],
  ]),
  sourceId: sourceId('chat'),
  now: 1_700_000_000_000,
  locale: 'en-GB',
  timeZone: 'Europe/Rome',
}

const attendee = (id: string): Participant => ({ id: contactId(id), status: 'needs-action' })
const withBruno = [attendee('bruno')]
const withBrunoAndCarla = [attendee('bruno'), attendee('carla')]
const nineOClock = /Thursday,? 12 November 2026,? (at )?09:00/
const linkOfE1 = 'index.html#event=chat%2Fteam%2Fe1'

function event(changes: Partial<EventValues> = {}, id = 'e1'): StoredEvent {
  return {
    id: eventId(id),
    calendarId: calendarId('team'),
    revision: 1,
    event: eventValues({ title: 'Dentist', ...changes }),
    recurrenceOverrides: {},
  }
}

const calendar = (name: string, color = '#2563eb'): StoredCalendar => ({
  id: calendarId('team'),
  name,
  color,
  order: 1,
  revision: 1,
})

const told = (...changes: ChatChange[]) => notificationsOf(changes, context)
const changed = (before: StoredEvent, after: StoredEvent): ChatChange => ({
  kind: 'event',
  before,
  after,
})
const bruno = (before: Partial<EventValues>, after: Partial<EventValues>) =>
  told(
    changed(
      event({ participants: withBruno, ...before }),
      event({ participants: withBruno, ...after }),
    ),
  )

it('is quiet about an event that has no attendees: it involves nobody, so only the link is there', () => {
  expect(told({ kind: 'event', after: event() })).toEqual({ href: linkOfE1 })
  expect(told(changed(event(), event({ title: 'Dentist 2' })))).toEqual({ href: linkOfE1 })
  expect(told(changed(event(), event({ status: 'cancelled' })))).toEqual({ href: linkOfE1 })
  expect(told({ kind: 'event', before: event() })).toBeUndefined() // deleted: there is nothing to open
})

it('tells the attendee of a new event with all the details, and puts a short line in the chat', () => {
  const place = [{ name: 'Room 4' }]
  const result = told({
    kind: 'event',
    after: event({ participants: withBrunoAndCarla, locations: place }),
  })

  expect(Object.keys(result?.notify ?? {})).toEqual(['bruno', 'carla'])
  expect(result?.notify?.bruno).toMatch(
    new RegExp(`^Ada added you to “Dentist”: ${nineOClock.source}, at “Room 4”, with Carla$`),
  )
  expect(result?.notify?.carla).toMatch(/, with Bruno$/) // each one has the others
  expect(result?.info).toBe('Ada created “Dentist” with Bruno and Carla')
  expect(result?.href).toBe(linkOfE1)
})

it('tells what changed, with the old and the new value', () => {
  const moved = bruno({}, { start: localDateTime('2026-11-12T11:00:00') })
  expect(moved?.notify?.bruno).toMatch(
    new RegExp(`^Ada rescheduled “Dentist” from ${nineOClock.source} to .*11:00$`),
  )
  expect(moved?.info).toBe('Ada changed “Dentist”') // the chat has the short line

  const several = bruno({}, { title: 'Dentist 2', locations: [{ name: 'Room 4' }] })
  expect(several?.notify?.bruno).toBe(
    'Ada changed “Dentist 2”: title from “Dentist” to “Dentist 2”; place set to “Room 4”',
  )
  expect(
    bruno({ locations: [{ name: 'Room 4' }] }, { locations: [{ name: 'Room 5' }] })?.notify?.bruno,
  ).toBe('Ada changed “Dentist”: place from “Room 4” to “Room 5”')
  expect(bruno({ locations: [{ name: 'Room 4' }] }, { locations: [] })?.notify?.bruno).toBe(
    'Ada changed “Dentist”: place removed',
  )
  expect(bruno({}, { duration: duration('PT2H') })?.notify?.bruno).toBe(
    'Ada changed “Dentist”: length changed',
  )
})

it('tells that an event was cancelled, with when it was, or is tentative or confirmed again', () => {
  expect(bruno({}, { status: 'cancelled' })?.notify?.bruno).toMatch(
    new RegExp(`^Ada cancelled “Dentist”, planned for ${nineOClock.source}$`),
  )
  expect(bruno({}, { status: 'tentative' })?.notify?.bruno).toBe(
    'Ada changed “Dentist”: status: tentative',
  )
  expect(bruno({ status: 'cancelled' }, { status: 'confirmed' })?.notify?.bruno).toBe(
    'Ada changed “Dentist”: status: confirmed',
  )
})

it('tells the attendees that an event was deleted, and the chat', () => {
  const result = told({ kind: 'event', before: event({ participants: withBruno }) })

  expect(result?.notify?.bruno).toMatch(
    new RegExp(`^Ada deleted “Dentist”, planned for ${nineOClock.source}$`),
  )
  expect(result?.info).toBe('Ada deleted “Dentist”')
  expect(result?.href).toBe('index.html#1700000000000') // it is gone: the chat line has the time
})

it('tells only the attendees, and the author too when they are one', () => {
  const both = [attendee('ada'), attendee('bruno')]
  const result = told(
    changed(event({ participants: both }), event({ participants: both, status: 'cancelled' })),
  )

  expect(Object.keys(result?.notify ?? {})).toEqual(['ada', 'bruno']) // not carla
})

it('tells the person that was added about the event, and the others that were there about the change', () => {
  const before = event({ participants: withBruno })

  const added = told(changed(before, event({ participants: withBrunoAndCarla })))
  expect(Object.keys(added?.notify ?? {})).toEqual(['carla']) // only the new one: nothing else changed
  expect(added?.notify?.carla).toMatch(/^Ada added you to “Dentist”: .*, with Bruno$/)
  expect(added?.info).toBe('Ada added Carla to “Dentist”')

  const both = told(changed(before, event({ title: 'Dentist 2', participants: withBrunoAndCarla })))
  expect(both?.notify?.bruno).toBe('Ada changed “Dentist 2”: title from “Dentist” to “Dentist 2”')
  expect(both?.notify?.carla).toMatch(/^Ada added you to “Dentist 2”/)
})

it('tells nothing of what is not worth a notification, and not of the answers of the attendees', () => {
  const quiet: Partial<EventValues>[] = [
    { description: 'Bring the forms' },
    { keywords: ['health'] },
    { color: '#dc2626' },
    { participants: [{ id: contactId('bruno'), status: 'accepted' }] }, // an answer
  ]
  for (const change of quiet) {
    expect(bruno({}, change)).toEqual({ href: linkOfE1 }) // nobody is told, nothing is in the chat
  }
})

it('writes the whole time in the language and the time zone of the author, without the name of the zone', () => {
  const rome = told({ kind: 'event', after: event({ participants: withBruno }) })
  expect(rome?.notify?.bruno).toMatch(
    /^Ada added you to “Dentist”: Thursday,? 12 November 2026,? (at )?09:00$/,
  )

  const tokyo = notificationsOf([{ kind: 'event', after: event({ participants: withBruno }) }], {
    ...context,
    timeZone: 'Asia/Tokyo',
  })
  expect(tokyo?.notify?.bruno).toMatch(
    /^Ada added you to “Dentist”: Thursday,? 12 November 2026,? (at )?17:00$/, // the same moment
  )
})

it('puts the calendars that are made, renamed and deleted in the chat, and notifies nobody', () => {
  // A line in the chat that is not for an event has the time as its link, so that it is not replaced.
  expect(told({ kind: 'calendar', after: calendar('Parties') })).toEqual({
    info: 'Ada created a new calendar: “Parties”',
    href: 'index.html#1700000000000',
  })
  expect(told({ kind: 'calendar', before: calendar('Team'), after: calendar('Crew') })?.info).toBe(
    'Ada renamed the calendar “Team” to “Crew”',
  )
  expect(told({ kind: 'calendar', before: calendar('Team') })?.info).toBe(
    'Ada deleted the calendar “Team”',
  )
  expect(
    told({ kind: 'calendar', before: calendar('Team'), after: calendar('Team', '#dc2626') }),
  ).toBeUndefined() // the color is not told
})

it('puts what was done more than once in one text for each person, and one line in the chat', () => {
  const first = event({ title: 'Dentist', participants: withBruno }, 'e1')
  const second = event({ title: 'Gym', participants: withBruno }, 'e2')
  const result = told(
    { kind: 'event', after: first },
    { kind: 'event', after: second },
    changed(first, event({ title: 'Dentist', participants: withBruno, status: 'cancelled' }, 'e1')),
  )

  // The first event was made and cancelled in one go: it is told as new, once.
  expect(result?.notify?.bruno).toMatch(/^Ada added you to “Dentist”: .* \(and 1 more\)$/)
  expect(result?.info).toBe('Ada made 2 changes')
  expect(result?.href).toBe(linkOfE1) // the first of the events that are involved
})
