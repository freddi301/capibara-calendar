import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type { Query } from '@tanstack/react-query'
import type {
  PersistedClient,
  PersistQueryClientProviderProps,
} from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'
import { getApi } from '@/api'
import { refOfKey } from './calendars'

const day = 24 * 60 * 60 * 1000

const persister = createAsyncStoragePersister({
  key: 'capibara-calendar-query-cache',
  throttleTime: 300,
  serialize: (client) => client as unknown as string,
  deserialize: (stored) => stored as unknown as PersistedClient,
  storage: {
    getItem: (key) => get<string>(key).then((stored) => stored ?? null),
    setItem: (key, value) => set(key, value),
    removeItem: (key) => del(key),
  },
})

const isFromServer = (calendarUrl: string) =>
  getApi()
    .sources()
    .some(({ id, kind }) => id === refOfKey(calendarUrl).sourceId && kind === 'caldav')

function isKept({ queryKey }: Query) {
  if (queryKey[0] === 'calendars') return true
  return queryKey[0] === 'events' && isFromServer(String(queryKey[1]))
}

export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister,
  maxAge: 7 * day,
  buster: '5',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) => query.state.status === 'success' && isKept(query),
  },
}

export async function forgetPersistedQueries() {
  try {
    await persister.removeClient()
  } catch {
    // The database is not there, or not open: nothing is kept
  }
}
