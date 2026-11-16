import { i18n } from '@lingui/core'
import { describe, expect, it, vi } from 'vitest'
import {
  activeTimeZone,
  activeWeekStart,
  applySettings,
  setChoice,
  timeZones,
  watchSystemTheme,
} from '../lib/settings'
import { getStored, setStored } from '../lib/use-stored'
import { matchMediaMock } from './mocks/match-media'
import { seedStored, seedText, storedJson } from './support/stored'

const loadSettings = () => getStored().settings
const saveSettings = (settings: object) => {
  setStored({ settings })
}
const isDark = () => document.documentElement.classList.contains('dark')

function mockSystemTheme(dark: boolean) {
  const listeners: (() => void)[] = []
  matchMediaMock.mockReturnValue({
    matches: dark,
    addEventListener: (_type: string, listener: () => void) => listeners.push(listener),
  } as unknown as ReturnType<typeof matchMediaMock>)
  return listeners
}

describe('loading settings', () => {
  it('follows the system when nothing is stored', () => {
    expect(loadSettings()).toEqual({})
  })

  it('reads the stored choices', () => {
    seedStored({ settings: { language: 'it', theme: 'dark' } })
    expect(loadSettings()).toEqual({ language: 'it', theme: 'dark' })
  })

  it('ignores an invalid choice and keeps the valid one', () => {
    seedStored({ settings: { language: 'fr', theme: 'dark' } })
    expect(loadSettings()).toEqual({ theme: 'dark' })
  })

  it('ignores stored text that is not settings', () => {
    for (const stored of ['not json', '42', 'null', '[]']) {
      seedText(stored)
      expect(loadSettings()).toEqual({})
    }
  })
})

describe('saving settings', () => {
  it('stores only what was chosen', () => {
    saveSettings({ theme: 'light' })
    expect(storedJson().settings).toEqual({ theme: 'light' })
  })

  it('stores nothing when everything follows the system', () => {
    saveSettings({ language: 'it' })
    saveSettings({})
    expect(storedJson().settings).toEqual({})
  })

  it('changes one choice and validates it', () => {
    expect(setChoice({ theme: 'dark' }, 'language', 'it')).toEqual({
      language: 'it',
      theme: 'dark',
    })
    expect(setChoice({ language: 'it', theme: 'dark' }, 'language', 'system')).toEqual({
      theme: 'dark',
    })
    expect(setChoice({}, 'language', 'fr')).toEqual({})
  })
})

describe('applying settings', () => {
  it('uses the chosen theme, whatever the system says', async () => {
    mockSystemTheme(true)
    await applySettings({ theme: 'light' })
    expect(isDark()).toBe(false)

    mockSystemTheme(false)
    await applySettings({ theme: 'dark' })
    expect(isDark()).toBe(true)
  })

  it('follows the system theme when none is chosen', async () => {
    mockSystemTheme(true)
    await applySettings({})
    expect(isDark()).toBe(true)

    mockSystemTheme(false)
    await applySettings({})
    expect(isDark()).toBe(false)
  })

  it('uses the chosen language, or the browser language when none is chosen', async () => {
    await applySettings({ language: 'it' })
    expect(i18n.locale).toBe('it')

    await applySettings({}) // the browser reports en-US
    expect(i18n.locale).toBe('en')
  })

  it('follows the system theme live, until a theme is chosen', () => {
    const listeners = mockSystemTheme(true)
    watchSystemTheme()

    listeners.forEach((listener) => {
      listener()
    })
    expect(isDark()).toBe(true)

    seedStored({ settings: { theme: 'light' } })
    listeners.forEach((listener) => {
      listener()
    })
    expect(isDark()).toBe(false)
  })
})

describe('time zone and first day of the week', () => {
  const store = (settings: object) => {
    seedStored({ settings })
  }

  it('reads and keeps both choices, and drops the ones that are not valid', () => {
    store({ timeZone: 'Europe/Rome', weekStart: 'sunday' })
    expect(loadSettings()).toEqual({ timeZone: 'Europe/Rome', weekStart: 'sunday' })

    store({ timeZone: 'Mars/Phobos', weekStart: 'wednesday', theme: 'dark' })
    expect(loadSettings()).toEqual({ theme: 'dark' })
  })

  it('saves them with the others, and forgets them when they follow the system', () => {
    saveSettings({ timeZone: 'Europe/Rome', weekStart: 'saturday', language: 'it' })
    expect(storedJson().settings).toEqual({
      language: 'it',
      timeZone: 'Europe/Rome',
      weekStart: 'saturday',
    })
    saveSettings({})
    expect(storedJson().settings).toEqual({})
  })

  it('changes them one at a time and validates them', () => {
    expect(setChoice({}, 'timeZone', 'Asia/Tokyo')).toEqual({ timeZone: 'Asia/Tokyo' })
    expect(setChoice({ timeZone: 'Asia/Tokyo' }, 'timeZone', 'system')).toEqual({})
    expect(setChoice({}, 'weekStart', 'sunday')).toEqual({ weekStart: 'sunday' })
    expect(setChoice({}, 'timeZone', 'Not/AZone')).toEqual({})
    expect(setChoice({}, 'weekStart', 'friday')).toEqual({})
  })

  it('uses the system time zone until one is chosen', () => {
    expect(activeTimeZone()).toBe(Temporal.Now.timeZoneId())
    store({ timeZone: 'Asia/Tokyo' })
    expect(activeTimeZone()).toBe('Asia/Tokyo')
  })

  it('starts the week on the chosen day', () => {
    store({ weekStart: 'monday' })
    expect(activeWeekStart()).toBe(1)
    store({ weekStart: 'saturday' })
    expect(activeWeekStart()).toBe(6)
    store({ weekStart: 'sunday' })
    expect(activeWeekStart()).toBe(7)
  })

  it('starts the week on the day of the browser region until one is chosen', () => {
    const region = vi.spyOn(window.navigator, 'language', 'get')
    for (const [language, firstDay] of [
      ['it-IT', 1],
      ['en-GB', 1],
      ['en-US', 7],
      ['ar-EG', 6],
    ] as const) {
      region.mockReturnValue(language)
      expect(activeWeekStart()).toBe(firstDay)
    }
  })

  it('starts the week on Monday when the browser cannot tell the habit of its region', () => {
    const unsupported = vi.spyOn(Intl.Locale.prototype, 'getWeekInfo').mockImplementation(() => {
      throw new TypeError('not supported')
    })
    expect(activeWeekStart()).toBe(1)
    unsupported.mockRestore()
  })

  it('offers the time zones of the browser, and UTC', () => {
    expect(timeZones).toContain('UTC')
    expect(timeZones).toContain('Europe/Rome')
    expect(new Set(timeZones).size).toBe(timeZones.length)
  })
})
