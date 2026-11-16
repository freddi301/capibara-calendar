import { describe, expect, it } from 'vitest'
import { getStored, setStored } from '../lib/use-stored'
import { seedText } from './support/stored'

const hiddenCalendars = () => getStored().hiddenCalendars
const saveHiddenCalendars = (hidden: string[]) => {
  setStored({ hiddenCalendars: hidden })
}

describe('hidden calendars', () => {
  it('are none until some are hidden: every calendar is shown', () => {
    expect(hiddenCalendars()).toEqual([])
  })

  it('are remembered', () => {
    saveHiddenCalendars(['/work/', '/personal/'])
    expect(hiddenCalendars()).toEqual(['/work/', '/personal/'])
  })

  it('are forgotten when none is hidden any more', () => {
    saveHiddenCalendars(['/work/'])
    saveHiddenCalendars([])
    expect(hiddenCalendars()).toEqual([])
  })

  it('are none when what was stored is not a list of addresses', () => {
    for (const stored of [{ a: 1 }, [1, 2], 'not a list', '/work/']) {
      seedText(JSON.stringify({ hiddenCalendars: stored }))
      expect(hiddenCalendars()).toEqual([])
    }
  })
})
