import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import type {
  PersistedClient,
  PersistQueryClientProviderProps,
} from '@tanstack/react-query-persist-client'
import { del, get, set } from 'idb-keyval'

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

const kept = ['events', 'calendars']

export const persistOptions: PersistQueryClientProviderProps['persistOptions'] = {
  persister,
  maxAge: 7 * day,
  buster: '1',
  dehydrateOptions: {
    shouldDehydrateQuery: (query) =>
      query.state.status === 'success' && kept.includes(String(query.queryKey[0])),
  },
}

export async function forgetPersistedQueries() {
  try {
    await persister.removeClient()
  } catch {
    // The database is not there, or not open: nothing is kept
  }
}
