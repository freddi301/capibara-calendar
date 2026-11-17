import 'fake-indexeddb/auto'
import { i18n } from '@lingui/core'
import 'temporal-polyfill/global'
import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeEach, vi } from 'vitest'
import { setApi } from '../api'
import { matchMediaMock } from './mocks/match-media'
import { server } from './mocks/server'
import { giveSizes } from './virtual'

// The tests have no IndexedDB; what is kept in it is tested on its own.
vi.mock('../lib/query-persist', () => ({
  persistOptions: {},
  forgetPersistedQueries: () => Promise.resolve(),
}))

// IndexedDB answers later than a map does, most of all when many files run at once.
configure({ asyncUtilTimeout: 4000 })

server.listen({ onUnhandledFrame: 'error' })

window.matchMedia = matchMediaMock as unknown as typeof window.matchMedia

// The messages (toasts) are swiped away with a pointer that they capture: jsdom has no capture.
Element.prototype.setPointerCapture = () => undefined
Element.prototype.releasePointerCapture = () => undefined

// The default layout is a virtual list: jsdom has no layout, so its rows are given a size.
beforeEach(() => {
  setApi(undefined)
  giveSizes()
})

afterEach(() => {
  cleanup()
  server.resetHandlers()
  localStorage.clear()
  document.documentElement.classList.remove('dark')
  i18n.activate('en')
})

afterAll(() => {
  server.close()
})

i18n.loadAndActivate({ locale: 'en', messages: {} })
