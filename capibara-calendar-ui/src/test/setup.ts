import { i18n } from '@lingui/core'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterAll, afterEach } from 'vitest'
import { server } from './mocks/server'

server.listen({ onUnhandledFrame: 'error' })

afterEach(() => {
  cleanup()
  server.resetHandlers()
})

afterAll(() => server.close())

i18n.loadAndActivate({ locale: 'en', messages: {} })
