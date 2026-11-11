import { i18n } from '@lingui/core'
import 'temporal-polyfill/global'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach } from 'vitest'
import { matchMediaMock } from './mocks/match-media'
import { server } from './mocks/server'

server.listen({ onUnhandledFrame: 'error' })

window.matchMedia = matchMediaMock as unknown as typeof window.matchMedia

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
