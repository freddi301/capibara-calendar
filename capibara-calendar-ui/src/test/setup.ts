// The setup of every test, also of the unit tests that run without a DOM (see setup-dom.ts).
import 'fake-indexeddb/auto'
import { i18n } from '@lingui/core'
import 'temporal-polyfill/global'
import { afterEach, beforeEach, vi } from 'vitest'
import { setApi } from '../api'

// The tests have no IndexedDB; what is kept in it is tested on its own.
vi.mock('../lib/query-persist', () => ({
  persistOptions: {},
  forgetPersistedQueries: () => Promise.resolve(),
}))

beforeEach(() => {
  setApi(undefined)
})

afterEach(() => {
  // A unit test that needs the storage of the browser runs in jsdom (`@vitest-environment jsdom`).
  if (typeof window !== 'undefined') localStorage.clear()
  i18n.activate('en')
})

i18n.loadAndActivate({ locale: 'en', messages: {} })
