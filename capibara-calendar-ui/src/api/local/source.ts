import {
  ApiError,
  calendarId as makeCalendarId,
  eventId as makeEventId,
  fullRights,
  revision,
  type Calendar,
  type CalendarEvent,
  type CalendarRef,
  type CalendarSource,
  type CalendarValues,
  type DateRange,
  type EditScope,
  type EventRef,
  type EventPatch,
  type EventValues,
  type ListOptions,
  type Revision,
  type SourceInfo,
} from '../calendar-api'
import {
  deleteDocument,
  newDocument,
  occurrenceFor,
  occurrencesOf,
  sortByStart,
  toCalendarEvent,
  updateDocument,
  type Changes,
} from '../shared/documents'
import { applyPatch } from '../shared/patch'
import type { StoredCalendar, StoredEvent } from '../stored-documents'
import type { DocumentStore, Tables } from './store'

const makeId = () => crypto.randomUUID()

async function findCalendar(tables: Tables, id: string) {
  const calendar = await tables.calendars.get(id)
  if (!calendar) throw new ApiError('notFound')
  return calendar
}

async function findEvent(tables: Tables, ref: EventRef) {
  const doc = await tables.events.get(ref.eventId)
  if (doc?.calendarId !== ref.calendarId) throw new ApiError('notFound')
  return doc
}

type Occurrence = {
  values: EventValues
  recurrenceId?: CalendarEvent['ref']['recurrenceId']
  index: number
}

export class LocalSource implements CalendarSource {
  readonly info: SourceInfo
  private readonly store: DocumentStore

  constructor(info: SourceInfo, store: DocumentStore) {
    this.info = info
    this.store = store
  }

  subscribe(listener: () => void) {
    return this.store.subscribe(listener)
  }

  check() {
    return this.store.read(() => Promise.resolve())
  }

  private calendarOf(stored: StoredCalendar): Calendar {
    return {
      ref: { sourceId: this.info.id, calendarId: stored.id },
      name: stored.name,
      color: stored.color,
      rights: fullRights,
    }
  }

  private eventOf(doc: StoredEvent, color: string | undefined, occurrence: Occurrence) {
    return toCalendarEvent(doc, occurrence, {
      sourceId: this.info.id,
      calendarId: doc.calendarId,
      color,
    })
  }

  private async eventNow(
    tables: Tables,
    id: string,
    fallback: StoredEvent,
    occurrence: Occurrence,
  ) {
    const doc = (await tables.events.get(id)) ?? fallback
    const calendar = await tables.calendars.get(doc.calendarId)
    return this.eventOf(doc, calendar?.color, occurrence)
  }

  listCalendars() {
    return this.store.read(async ({ calendars }) =>
      (await calendars.list())
        .sort((first, second) => first.order - second.order)
        .map((stored) => this.calendarOf(stored)),
    )
  }

  createCalendar(values: CalendarValues) {
    return this.store.write(async ({ calendars }) => {
      const order = Math.max(0, ...(await calendars.list()).map((other) => other.order)) + 1
      const stored: StoredCalendar = { id: makeCalendarId(makeId()), ...values, order, revision: 1 }
      await calendars.put(stored)
      return this.calendarOf(stored)
    })
  }

  updateCalendar(calendar: CalendarRef, values: Partial<CalendarValues>) {
    return this.store.write(async (tables) => {
      const stored = await findCalendar(tables, calendar.calendarId)
      const next = { ...stored, ...values, revision: stored.revision + 1 }
      await tables.calendars.put(next)
      return this.calendarOf(next)
    })
  }

  async deleteCalendar(calendar: CalendarRef) {
    await this.store.write(async (tables) => {
      await findCalendar(tables, calendar.calendarId)
      await tables.events.removeOf(calendar.calendarId)
      await tables.calendars.remove(calendar.calendarId)
    })
  }

  listEvents(calendar: CalendarRef, range: DateRange, options: ListOptions) {
    return this.store.read(async (tables) => {
      const stored = await findCalendar(tables, calendar.calendarId)
      const docs = await tables.events.listOf(calendar.calendarId)
      const found = docs.flatMap((doc) =>
        occurrencesOf(doc, range, options.timeZone).map((occurrence) =>
          this.eventOf(doc, stored.color, occurrence),
        ),
      )
      return sortByStart(found, options.timeZone)
    })
  }

  revision(calendar: CalendarRef): Promise<Revision | undefined> {
    return this.store.read(async (tables) =>
      revision(String((await findCalendar(tables, calendar.calendarId)).revision)),
    )
  }

  getEvent(event: EventRef) {
    return this.store.read(async (tables) => {
      const doc = await findEvent(tables, event)
      const occurrence = occurrenceFor(doc, event.recurrenceId)
      if (!occurrence) throw new ApiError('notFound')
      return this.eventOf(doc, (await tables.calendars.get(doc.calendarId))?.color, occurrence)
    })
  }

  private async apply(tables: Tables, calendarIdValue: string, changes: Changes) {
    const calendar = await findCalendar(tables, calendarIdValue)
    for (const id of changes.remove) await tables.events.remove(id)
    for (const doc of changes.write) {
      const existing = await tables.events.get(doc.id)
      await tables.events.put({ ...doc, revision: existing ? doc.revision + 1 : 1 })
    }
    await tables.calendars.put({ ...calendar, revision: calendar.revision + 1 })
  }

  createEvent(calendar: CalendarRef, values: EventValues) {
    return this.store.write(async (tables) => {
      await findCalendar(tables, calendar.calendarId)
      const doc = newDocument(makeEventId(makeId()), calendar.calendarId, values)
      await this.apply(tables, calendar.calendarId, { write: [doc], remove: [] })
      return this.eventNow(tables, doc.id, doc, { values, index: 0 })
    })
  }

  updateEvent(event: CalendarEvent, patch: EventPatch, scope: EditScope) {
    return this.store.write(async (tables) => {
      const doc = await findEvent(tables, event.ref)
      const changes = updateDocument(doc, patch, event.ref.recurrenceId, scope, () =>
        makeEventId(makeId()),
      )
      await this.apply(tables, doc.calendarId, changes)
      const updated = (await tables.events.get(doc.id)) ?? doc
      return this.eventNow(
        tables,
        doc.id,
        doc,
        occurrenceFor(updated, scope === 'all' ? undefined : event.ref.recurrenceId) ?? {
          values: applyPatch(doc.event, patch),
          index: 0,
        },
      )
    })
  }

  async deleteEvent(event: CalendarEvent, scope: EditScope) {
    await this.store.write(async (tables) => {
      const doc = await findEvent(tables, event.ref)
      if (String(doc.revision) !== event.revision) throw new ApiError('conflict')
      await this.apply(tables, doc.calendarId, deleteDocument(doc, event.ref.recurrenceId, scope))
    })
  }

  moveEvent(event: CalendarEvent, to: CalendarRef) {
    return this.store.write(async (tables) => {
      const doc = await findEvent(tables, event.ref)
      if (String(doc.revision) !== event.revision) throw new ApiError('conflict')
      const target = await findCalendar(tables, to.calendarId)
      await this.apply(tables, doc.calendarId, { write: [], remove: [] })
      const moved = { ...doc, calendarId: to.calendarId, revision: doc.revision + 1 }
      await tables.events.put(moved)
      await tables.calendars.put({ ...target, revision: target.revision + 1 })
      return this.eventOf(
        moved,
        target.color,
        occurrenceFor(moved) ?? { values: moved.event, index: 0 },
      )
    })
  }
}
