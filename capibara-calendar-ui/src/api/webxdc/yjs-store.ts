import { isEqual } from 'es-toolkit'
import * as Y from 'yjs'
import type { StoredCalendar, StoredEvent } from '../stored-documents'
import type { DocumentStore, EventTable, Table, Tables } from '../local/store'

const mine = 'capibara-local'

type Fields = Record<string, unknown>
type Answer = { status: string; at: number }

function writeFields(map: Y.Map<unknown>, fields: Fields, kept: string[] = []) {
  for (const [key, value] of Object.entries(fields)) {
    if (!isEqual(map.get(key), value)) map.set(key, value)
  }
  for (const key of [...map.keys()]) if (!(key in fields) && !kept.includes(key)) map.delete(key)
}

const nested = (map: Y.Map<unknown>, key: string) => {
  const found = map.get(key)
  if (found instanceof Y.Map) return found as Y.Map<unknown>
  const created = new Y.Map<unknown>()
  map.set(key, created)
  return created
}

function writePeople(people: Y.Map<unknown>, participants: StoredEvent['event']['participants']) {
  const wanted = new Map(
    participants.map(({ id, status }, index) => [String(id), { status, index }]),
  )
  for (const [id, { status, index }] of wanted) {
    const before = people.get(id) as Answer | undefined
    if (!before) people.set(id, { status, at: Date.now() + index / 1000 })
    else if (before.status !== status) people.set(id, { ...before, status })
  }
  for (const id of [...people.keys()]) if (!wanted.has(id)) people.delete(id)
}

function calendarOf(map: Y.Map<unknown>) {
  return map.toJSON() as StoredCalendar
}

function eventOf(map: Y.Map<unknown>): StoredEvent {
  const json = map.toJSON() as Omit<StoredEvent, 'event'> & {
    event: Omit<StoredEvent['event'], 'participants'> & { participants?: Record<string, Answer> }
  }
  const { participants = {}, ...rest } = json.event
  const ordered = Object.entries(participants).sort(
    ([first, a], [second, b]) => a.at - b.at || first.localeCompare(second),
  )
  return {
    ...json,
    event: {
      ...rest,
      participants: ordered.map(([id, { status }]) => ({ id, status })),
    },
  } as StoredEvent
}

export class YjsStore implements DocumentStore {
  private readonly doc: Y.Doc
  private readonly onWritten: () => void
  private readonly calendars: Y.Map<Y.Map<unknown>>
  private readonly events: Y.Map<Y.Map<unknown>>
  private queue: Promise<unknown> = Promise.resolve()
  private readonly tables: Tables

  constructor(doc: Y.Doc, onWritten: () => void) {
    this.doc = doc
    this.onWritten = onWritten
    this.calendars = doc.getMap('calendars')
    this.events = doc.getMap('events')
    this.tables = { calendars: this.calendarTable(), events: this.eventTable() }
  }

  private calendarTable(): Table<StoredCalendar> {
    const rows = this.calendars
    return {
      get: (id) =>
        Promise.resolve(rows.has(id) ? calendarOf(rows.get(id) as Y.Map<unknown>) : undefined),
      list: () => Promise.resolve([...rows.values()].map(calendarOf)),
      put: (row) => {
        this.doc.transact(() => {
          const map = rows.get(row.id) ?? new Y.Map<unknown>()
          if (!rows.has(row.id)) rows.set(row.id, map)
          writeFields(map, { ...row })
        }, mine)
        return Promise.resolve()
      },
      remove: (id) => {
        this.doc.transact(() => {
          rows.delete(id)
        }, mine)
        return Promise.resolve()
      },
    }
  }

  private eventTable(): EventTable {
    const rows = this.events
    const all = () => [...rows.values()].map(eventOf)
    return {
      get: (id) =>
        Promise.resolve(rows.has(id) ? eventOf(rows.get(id) as Y.Map<unknown>) : undefined),
      list: () => Promise.resolve(all()),
      listOf: (calendarId) => Promise.resolve(all().filter((row) => row.calendarId === calendarId)),
      put: (row) => {
        this.doc.transact(() => {
          const map = rows.get(row.id) ?? new Y.Map<unknown>()
          if (!rows.has(row.id)) rows.set(row.id, map)
          writeFields(
            map,
            {
              id: row.id,
              calendarId: row.calendarId,
              revision: row.revision,
              recurrenceOverrides: row.recurrenceOverrides,
            },
            ['event'],
          )
          const event = nested(map, 'event')
          const { participants, ...fields } = row.event
          writeFields(event, fields, ['participants'])
          writePeople(nested(event, 'participants'), participants)
        }, mine)
        return Promise.resolve()
      },
      remove: (id) => {
        this.doc.transact(() => {
          rows.delete(id)
        }, mine)
        return Promise.resolve()
      },
      removeOf: (calendarId) => {
        this.doc.transact(() => {
          for (const [id, map] of [...rows.entries()]) {
            if (map.get('calendarId') === calendarId) rows.delete(id)
          }
        }, mine)
        return Promise.resolve()
      },
    }
  }

  read<Result>(work: (tables: Tables) => Promise<Result>) {
    return work(this.tables)
  }

  write<Result>(work: (tables: Tables) => Promise<Result>) {
    const run = async () => {
      const result = await work(this.tables)
      this.onWritten()
      return result
    }
    const next = this.queue.then(run, run)
    this.queue = next.catch(() => undefined)
    return next
  }

  subscribe(listener: () => void) {
    const changed = (_update: Uint8Array, origin: unknown) => {
      if (origin !== mine) listener()
    }
    this.doc.on('update', changed)
    return () => {
      this.doc.off('update', changed)
    }
  }
}
