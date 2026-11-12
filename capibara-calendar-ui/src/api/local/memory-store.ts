import type { StoredCalendar, StoredEvent } from '../stored-documents'
import type { DocumentStore, EventTable, Table, Tables } from './store'

type Rows<Row> = Map<string, Row>

const tableOf = <Row extends { id: string }>(rows: Rows<Row>): Table<Row> => ({
  get: (id) => Promise.resolve(structuredClone(rows.get(id))),
  list: () => Promise.resolve([...rows.values()].map((row) => structuredClone(row))),
  put: (row) => {
    rows.set(row.id, structuredClone(row))
    return Promise.resolve()
  },
  remove: (id) => {
    rows.delete(id)
    return Promise.resolve()
  },
})

const eventTableOf = (rows: Rows<StoredEvent>): EventTable => ({
  ...tableOf(rows),
  listOf: (calendarId) =>
    Promise.resolve(
      [...rows.values()]
        .filter((row) => row.calendarId === calendarId)
        .map((row) => structuredClone(row)),
    ),
  removeOf: (calendarId) => {
    for (const [id, row] of rows) if (row.calendarId === calendarId) rows.delete(id)
    return Promise.resolve()
  },
})

export class MemoryStore implements DocumentStore {
  private calendars: Rows<StoredCalendar> = new Map()
  private events: Rows<StoredEvent> = new Map()
  private queue: Promise<unknown> = Promise.resolve()
  private readonly listeners = new Set<() => void>()

  read<Result>(work: (tables: Tables) => Promise<Result>) {
    return work({ calendars: tableOf(this.calendars), events: eventTableOf(this.events) })
  }

  write<Result>(work: (tables: Tables) => Promise<Result>) {
    const run = async () => {
      const calendars = new Map(this.calendars)
      const events = new Map(this.events)
      const result = await work({ calendars: tableOf(calendars), events: eventTableOf(events) })
      this.calendars = calendars
      this.events = events
      this.listeners.forEach((listener) => {
        listener()
      })
      return result
    }
    const next = this.queue.then(run, run)
    this.queue = next.catch(() => undefined)
    return next
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
