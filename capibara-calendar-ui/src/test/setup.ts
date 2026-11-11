import { i18n } from '@lingui/core'
import 'temporal-polyfill/global'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach, beforeEach, vi } from 'vitest'
import { saveConnection } from '../lib/connection'
import { matchMediaMock } from './mocks/match-media'
import { server } from './mocks/server'

// The tests have no IndexedDB; what is kept in it is tested on its own.
vi.mock('../lib/query-persist', () => ({
  persistOptions: {},
  forgetPersistedQueries: () => Promise.resolve(),
}))

server.listen({ onUnhandledFrame: 'error' })

window.matchMedia = matchMediaMock as unknown as typeof window.matchMedia

beforeEach(() => {
  saveConnection({ url: 'https://caldav.example/dav/', username: 'user', password: 'secret' })
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  localStorage.clear()
  sessionStorage.clear()
  document.documentElement.classList.remove('dark')
  i18n.activate('en')
})

afterAll(() => {
  server.close()
})

i18n.loadAndActivate({ locale: 'en', messages: {} })
