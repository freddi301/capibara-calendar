// The setup of the tests that render (after setup.ts): the unit tests run without it.
import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterEach, beforeEach } from 'vitest'
import { matchMediaMock } from './mocks/match-media'
import { giveSizes } from './virtual'

// IndexedDB answers later than a map does, most of all when many files run at once.
configure({ asyncUtilTimeout: 4000 })

window.matchMedia = matchMediaMock as unknown as typeof window.matchMedia

// The messages (toasts) are swiped away with a pointer that they capture: jsdom has no capture.
Element.prototype.setPointerCapture = () => undefined
Element.prototype.releasePointerCapture = () => undefined

// The default layout is a virtual list: jsdom has no layout, so its rows are given a size.
beforeEach(() => {
  giveSizes()
})

afterEach(() => {
  cleanup()
  document.documentElement.classList.remove('dark')
})
