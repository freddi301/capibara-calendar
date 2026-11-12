import type { StoredCalendar, StoredEvent } from '../stored-documents'

export interface Table<Row extends { id: string }> {
  get(id: string): Promise<Row | undefined>
  list(): Promise<Row[]>
  put(row: Row): Promise<void>
  remove(id: string): Promise<void>
}

export interface EventTable extends Table<StoredEvent> {
  listOf(calendarId: string): Promise<StoredEvent[]>
  removeOf(calendarId: string): Promise<void>
}

export type Tables = {
  calendars: Table<StoredCalendar>
  events: EventTable
}

export interface DocumentStore {
  read<Result>(work: (tables: Tables) => Promise<Result>): Promise<Result>
  write<Result>(work: (tables: Tables) => Promise<Result>): Promise<Result>
  subscribe(listener: () => void): () => void
}
