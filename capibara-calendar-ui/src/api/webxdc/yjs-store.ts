import { isEqual } from 'es-toolkit'
import * as Y from 'yjs'
import { contactId, type Contact } from '../calendar-api'
import type { StoredCalendar, StoredEvent } from '../stored-documents'
import type { DocumentStore, EventTable, Table, Tables } from '../local/store'
import type { ChatChange } from './notifications'

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

export async function introduce(store: DocumentStore, address: string, name: string) {
  const known = await store.read(async ({ contacts }) => (await contacts?.get(address))?.name)
  if (known === name) return false
  await store.write(async ({ contacts }) => {
    await contacts?.put({ id: contactId(address), name })
  })
  return true
}

export class YjsStore implements DocumentStore {
  private changes: ChatChange[] = []
  private readonly doc: Y.Doc
  private readonly onWritten: () => void
  private readonly calendars: Y.Map<Y.Map<unknown>>
  private readonly events: Y.Map<Y.Map<unknown>>
  private readonly people: Y.Map<string>
  private queue: Promise<unknown> = Promise.resolve()
  private readonly tables: Tables

  constructor(doc: Y.Doc, onWritten: () => void) {
    this.doc = doc
    this.onWritten = onWritten
    this.calendars = doc.getMap('calendars')
    this.events = doc.getMap('events')
    this.people = doc.getMap('people')
    this.tables = {
      calendars: this.calendarTable(),
      events: this.eventTable(),
      contacts: this.contactTable(),
    }
  }

  private calendarTable(): Table<StoredCalendar> {
    const rows = this.calendars
    return {
      get: (id) =>
        Promise.resolve(rows.has(id) ? calendarOf(rows.get(id) as Y.Map<unknown>) : undefined),
      list: () => Promise.resolve([...rows.values()].map(calendarOf)),
      put: (row) => {
        const before = rows.has(row.id) ? calendarOf(rows.get(row.id) as Y.Map<unknown>) : undefined
        this.doc.transact(() => {
          const map = rows.get(row.id) ?? new Y.Map<unknown>()
          if (!rows.has(row.id)) rows.set(row.id, map)
          writeFields(map, { ...row })
        }, mine)
        this.changes.push({ kind: 'calendar', before, after: row })
        return Promise.resolve()
      },
      remove: (id) => {
        const before = rows.has(id) ? calendarOf(rows.get(id) as Y.Map<unknown>) : undefined
        this.doc.transact(() => {
          rows.delete(id)
        }, mine)
        if (before) this.changes.push({ kind: 'calendar', before })
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
        const before = rows.has(row.id) ? eventOf(rows.get(row.id) as Y.Map<unknown>) : undefined
        this.changes.push({ kind: 'event', before, after: row })
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
              ...(row.sequence === undefined ? {} : { sequence: row.sequence }),
              ...(row.modified === undefined ? {} : { modified: row.modified }),
              ...(row.extra === undefined ? {} : { extra: row.extra }),
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
        const before = rows.has(id) ? eventOf(rows.get(id) as Y.Map<unknown>) : undefined
        this.doc.transact(() => {
          rows.delete(id)
        }, mine)
        if (before) this.changes.push({ kind: 'event', before })
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

  private contactTable(): Table<Contact> {
    const people = this.people
    const contactOf = (address: string): Contact => ({
      id: contactId(address),
      name: people.get(address) ?? '',
    })
    return {
      get: (id) => Promise.resolve(people.has(id) ? contactOf(id) : undefined),
      list: () => Promise.resolve([...people.keys()].map(contactOf)),
      put: (row) => {
        this.doc.transact(() => {
          people.set(row.id, row.name)
        })
        return Promise.resolve()
      },
      remove: (id) => {
        this.doc.transact(() => {
          people.delete(id)
        })
        return Promise.resolve()
      },
    }
  }

  takeChanges() {
    const taken = this.changes
    this.changes = []
    return taken
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
