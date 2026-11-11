import { describe, expect, it } from 'vitest'
import { hiddenCalendars, saveHiddenCalendars } from '../lib/filter'

const storageKey = 'capibara-calendar-hidden-calendars'

describe('hidden calendars', () => {
  it('are none until some are hidden: every calendar is shown', () => {
    expect(hiddenCalendars()).toEqual([])
  })

  it('are remembered', () => {
    saveHiddenCalendars(['/work/', '/personal/'])
    expect(hiddenCalendars()).toEqual(['/work/', '/personal/'])
  })

  it('are forgotten when none is hidden any more, and leave nothing behind', () => {
    saveHiddenCalendars(['/work/'])
    saveHiddenCalendars([])
    expect(hiddenCalendars()).toEqual([])
    expect(localStorage.getItem(storageKey)).toBeNull()
  })

  it('are none when what was stored is not a list of addresses', () => {
    for (const stored of ['{"a":1}', '[1,2]', 'not json', '"/work/"']) {
      localStorage.setItem(storageKey, stored)
      expect(hiddenCalendars()).toEqual([])
    }
  })
})
