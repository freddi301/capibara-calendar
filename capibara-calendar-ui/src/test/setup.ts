import { i18n } from '@lingui/core'
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

afterEach(() => {
  cleanup()
})

i18n.loadAndActivate({ locale: 'en', messages: {} })
