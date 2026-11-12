import { expect, vi } from 'vitest'
import { getApi } from '../api'
import {
  calendarId,
  eventId,
  localDateTime,
  revision,
  sourceId,
  type CalendarEvent as ContractEvent,
  type EditScope,
  type EventValues,
} from '../api/calendar-api'
import { decode } from '../api/caldav/codec'
import type { StoredEvent } from '../api/stored-documents'
import { Registry } from '../api/registry'
import { setApi } from '../api'
import { IndexedDbStore } from '../api/local/indexeddb-store'
import { MemoryStore } from '../api/local/memory-store'
import { LocalSource } from '../api/local/source'
import type { DocumentStore } from '../api/local/store'
import { newDocument, occurrenceFor, toCalendarEvent } from '../api/shared/documents'
import { occurrenceStarts } from '../api/shared/recurrence'
import type { DisplayEvent } from '../lib/display-event'
import { eventValuesOf, formValuesOf } from '../lib/event-form'
import { activeTimeZone } from '../lib/settings'
import type { CalendarEvent, CalendarInfo } from './legacy'

const testSource = import.meta.env.TEST_SOURCE === 'local' ? 'local' : 'memory'

let databases = 0

/** An event with a color of its own is in a calendar of that color: the color is the calendar's. */
const calendarOf = ({ calendarUrl, color }: CalendarEvent) =>
  color ? `${calendarUrl}~${color}` : calendarUrl

function newStore(): DocumentStore {
  if (testSource === 'memory') return new MemoryStore()
  databases += 1
  return new IndexedDbStore(`screens-${databases}`)
}

function docOf(event: CalendarEvent): StoredEvent {
  const id = eventId(event.uid)
  const calendar = calendarId(calendarOf(event))
  const fromIcs = event.isRecurring && event.ics ? decode(event.ics) : undefined
  if (fromIcs) {
    return {
      ...newDocument(id, calendar, fromIcs.event),
      recurrenceOverrides: fromIcs.recurrenceOverrides,
    }
  }
  const alerts =
    event.alerts ?? (event.reminder && event.reminder !== 'custom' ? [event.reminder] : [])
  const values = eventValuesOf({ ...event, alerts }, undefined, { appZone: activeTimeZone() })
  return newDocument(id, calendar, values)
}

/** The event as the screens get it from the source: the occurrence that the fixture is on, for a repeating one. */
export function contractOf(event: CalendarEvent): ContractEvent {
  const doc = docOf(event)
  let recurrenceId
  if (doc.event.recurrenceRules.length) {
    for (const start of occurrenceStarts(doc.event.start, doc.event.recurrenceRules)) {
      if (start.slice(0, 10) >= event.startDate) {
        recurrenceId = localDateTime(start)
        break
      }
    }
  }
  const occurrence = occurrenceFor(doc, recurrenceId) ?? { values: doc.event, index: 0 }
  const made = toCalendarEvent(doc, occurrence, {
    sourceId: sourceId(testSource),
    calendarId: doc.calendarId,
    color: event.color,
  })
  return event.etag ? { ...made, revision: revision(event.etag) } : made
}

/**
 * The source the screens read from, with these events in it: the real engines, as in the browser. The first
 * request waits for the events to be written.
 */
export function serveEvents(events: CalendarEvent[], calendars?: CalendarInfo[]) {
  const store = newStore()
  const urls = [...new Set(['/c/', ...events.map(({ calendarUrl }) => calendarUrl)])]
  const listed = calendars ?? urls.map((url) => ({ url, name: url, color: '' }))
  const written = store.write(async (tables) => {
    for (const [index, { url, name, color }] of listed.entries()) {
      await tables.calendars.put({ id: calendarId(url), name, color, order: index, revision: 1 })
    }
    for (const event of events) {
      if (event.color) {
        const id = calendarOf(event)
        await tables.calendars.put({
          id: calendarId(id),
          name: event.calendarUrl,
          color: event.color,
          order: 99,
          revision: 1,
        })
      }
      await tables.events.put(docOf(event))
    }
  })
  const gated: DocumentStore = {
    read: (work) => written.then(() => store.read(work)),
    write: (work) => written.then(() => store.write(work)),
    subscribe: (listener) => store.subscribe(listener),
  }
  const info = { id: sourceId(testSource), kind: testSource, name: testSource } as const
  const api = new Registry(() => new LocalSource(info, gated), [new LocalSource(info, gated)])
  for (const method of [
    'listEvents',
    'listCalendars',
    'getEvent',
    'revision',
    'createCalendar',
    'updateCalendar',
    'deleteCalendar',
    'createEvent',
    'updateEvent',
    'deleteEvent',
  ] as const) {
    vi.spyOn(api, method)
  }
  setApi(api)
  return api
}

/** The key of a calendar as the screens know it. */
export const keyOf = (url: string) => `${testSource}/${url}`

/** What a call to read the events of a calendar looks like. */
export const forRange = (url: string, range: { start: string; end: string }) =>
  [expect.objectContaining({ calendarId: url }), range, expect.anything()] as const

const formOf = (values: EventValues, event: ContractEvent) =>
  formValuesOf({ ...event, ...values, series: undefined }, { appZone: activeTimeZone() })

type Save = { form: ReturnType<typeof formOf>; uid?: string; revision?: string; scope?: EditScope }

/** Every save that was asked of the source, as the form of what was written. */
function savesOf(): Save[] {
  const api = getApi()
  const placeholder = contractOf({
    uid: 'new',
    calendarUrl: '/c/',
    url: '',
    ics: '',
    title: '',
    description: '',
    startDate: '2026-01-01',
    startTime: '',
    endDate: '',
    endTime: '',
  })
  const created = vi.mocked(api.createEvent).mock.calls.map(([ref, values]) => ({
    form: formOf(values, {
      ...placeholder,
      ref: { ...placeholder.ref, calendarId: ref.calendarId },
    }),
  }))
  const updated = vi.mocked(api.updateEvent).mock.calls.map(([event, values, scope]) => ({
    form: formOf(values, event),
    uid: event.ref.eventId,
    revision: event.revision,
    scope,
  }))
  return [...created, ...updated]
}

/** A save with these fields, of this event (none: a new one), for this scope (none: all of it). */
export function expectSaved(
  fields: unknown,
  original?: CalendarEvent | { asymmetricMatch: unknown },
  scope?: EditScope,
  which: 'any' | 'last' = 'any',
) {
  const saves = savesOf()
  const candidates = which === 'last' ? saves.slice(-1) : saves
  const found = candidates.some((save) => {
    try {
      expect(save.form).toEqual(fields)
      if (original && 'asymmetricMatch' in original) {
        expect(save.uid).toBeDefined()
        expect(save.scope).toBe(scope ?? 'all')
      } else if (original) {
        expect(save.uid).toBe(original.uid)
        expect(save.revision).toBe(original.etag ?? '1')
        expect(save.scope).toBe(scope ?? 'all')
      } else {
        expect(save.uid).toBeUndefined()
      }
      return true
    } catch {
      return false
    }
  })
  expect(found, `a save of ${JSON.stringify(fields)} in ${JSON.stringify(saves)}`).toBe(true)
}

export const saveCount = () => savesOf().length

export const deleteCount = () => vi.mocked(getApi().deleteEvent).mock.calls.length

export function expectDeleted(original: CalendarEvent, scope?: EditScope) {
  const [event, used] = vi.mocked(getApi().deleteEvent).mock.lastCall ?? []
  expect(event?.ref.eventId).toBe(original.uid)
  expect(event?.revision).toBe(original.etag ?? '1')
  expect(used).toBe(scope ?? 'all')
}

/** The next saves fail like this: once, or every time. */
export function failSaves(error: unknown, how: 'once' | 'always' = 'once') {
  const api = getApi()
  for (const method of ['createEvent', 'updateEvent'] as const) {
    const spy = vi.mocked(api[method])
    if (how === 'once') spy.mockRejectedValueOnce(error)
    else spy.mockRejectedValue(error)
  }
}

export function hangSaves() {
  const api = getApi()
  vi.mocked(api.createEvent).mockReturnValue(new Promise(() => undefined))
  vi.mocked(api.updateEvent).mockReturnValue(new Promise(() => undefined))
}

export function failDeletes(error: unknown, how: 'once' | 'always' = 'once') {
  const spy = vi.mocked(getApi().deleteEvent)
  if (how === 'once') spy.mockRejectedValueOnce(error)
  else spy.mockRejectedValue(error)
}

/** A calendar as the screens list it, from the calendar of a fixture. */
export const calendarInfoOf = ({ url, name, color }: CalendarInfo) =>
  ({
    url: keyOf(url),
    name,
    color,
    ref: { sourceId: sourceId(testSource), calendarId: calendarId(url) },
    sourceKind: testSource,
    sourceName: testSource,
  }) satisfies import('../lib/calendars').CalendarInfo

/** An event as the layouts get it: the plain fields, in the zone of the app. */
export const displayOf = (event: CalendarEvent): DisplayEvent => ({
  key: event.uid,
  calendarKey: keyOf(event.calendarUrl),
  title: event.title,
  description: event.description,
  startDate: event.startDate,
  startTime: event.startTime,
  endDate: event.endDate,
  endTime: event.endTime,
  location: event.location ?? '',
  tags: event.tags ?? '',
  videoLink: event.videoLink ?? '',
  hasAlerts: Boolean(event.reminder) || Boolean(event.alerts?.length),
  isRecurring: Boolean(event.isRecurring) || Boolean(event.repeat),
  status: event.status ?? 'confirmed',
  eventColor: event.eventColor || null,
  color: event.color,
  source: contractOf(event),
})
