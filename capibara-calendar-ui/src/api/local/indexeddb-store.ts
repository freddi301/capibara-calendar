import type { StoredCalendar, StoredEvent } from '../stored-documents'
import type { DocumentStore, EventTable, Table, Tables } from './store'

const calendarsName = 'calendars'
const eventsName = 'events'
const calendarIndex = 'calendarId'

function open(name: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 2)
    request.onupgradeneeded = () => {
      const database = request.result
      if (database.objectStoreNames.contains('documents')) database.deleteObjectStore('documents')
      if (!database.objectStoreNames.contains(calendarsName)) {
        database.createObjectStore(calendarsName, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(eventsName)) {
        database
          .createObjectStore(eventsName, { keyPath: 'id' })
          .createIndex(calendarIndex, calendarIndex)
      }
    }
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error ?? new Error('Cannot open the database'))
    }
  })
}

const asPromise = <Value>(request: IDBRequest<Value>) =>
  new Promise<Value>((resolve, reject) => {
    request.onsuccess = () => {
      resolve(request.result)
    }
    request.onerror = () => {
      reject(request.error ?? new Error('The database request failed'))
    }
  })

const tableOf = <Row extends { id: string }>(store: IDBObjectStore): Table<Row> => ({
  get: async (id) => (await asPromise(store.get(id))) as Row | undefined,
  list: async () => (await asPromise(store.getAll())) as Row[],
  put: async (row) => {
    await asPromise(store.put(row))
  },
  remove: async (id) => {
    await asPromise(store.delete(id))
  },
})

const eventTableOf = (store: IDBObjectStore): EventTable => ({
  ...tableOf<StoredEvent>(store),
  listOf: async (calendarId) =>
    (await asPromise(store.index(calendarIndex).getAll(calendarId))) as StoredEvent[],
  removeOf: async (calendarId) => {
    const keys = await asPromise(store.index(calendarIndex).getAllKeys(calendarId))
    await Promise.all(keys.map((key) => asPromise(store.delete(key))))
  },
})

export class IndexedDbStore implements DocumentStore {
  private readonly connection: Promise<IDBDatabase>
  private readonly channel: BroadcastChannel | undefined
  private readonly listeners = new Set<() => void>()
  private readonly name: string

  constructor(name = 'capibara-calendar-local') {
    this.name = name
    this.connection = open(name)
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(name)
      this.channel.onmessage = () => {
        this.notify()
      }
    }
  }

  private notify() {
    this.listeners.forEach((listener) => {
      listener()
    })
  }

  private async run<Result>(mode: IDBTransactionMode, work: (tables: Tables) => Promise<Result>) {
    const connection = await this.connection
    const transaction = connection.transaction([calendarsName, eventsName], mode)
    const done = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => {
        resolve()
      }
      transaction.onerror = () => {
        reject(transaction.error ?? new Error('The database request failed'))
      }
      transaction.onabort = () => {
        reject(transaction.error ?? new Error('The database request was aborted'))
      }
    })
    let result: Result
    try {
      result = await work({
        calendars: tableOf<StoredCalendar>(transaction.objectStore(calendarsName)),
        events: eventTableOf(transaction.objectStore(eventsName)),
      })
    } catch (error) {
      transaction.abort()
      await done.catch(() => undefined)
      throw error
    }
    await done
    return result
  }

  read<Result>(work: (tables: Tables) => Promise<Result>) {
    return this.run('readonly', work)
  }

  async write<Result>(work: (tables: Tables) => Promise<Result>) {
    const result = await this.run('readwrite', work)
    this.channel?.postMessage(this.name) // the other tabs are told, and not this one
    return result
  }

  subscribe(listener: () => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }
}
