import { i18n } from '@lingui/core'
import { describe, expect, it } from 'vitest'
import {
  applySettings,
  loadSettings,
  saveSettings,
  setChoice,
  watchSystemTheme,
} from '../lib/settings'
import { matchMediaMock } from './mocks/match-media'

const key = 'capibara-calendar-settings'
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
    localStorage.setItem(key, JSON.stringify({ language: 'it', theme: 'dark' }))
    expect(loadSettings()).toEqual({ language: 'it', theme: 'dark' })
  })

  it('ignores an invalid choice and keeps the valid one', () => {
    localStorage.setItem(key, JSON.stringify({ language: 'fr', theme: 'dark' }))
    expect(loadSettings()).toEqual({ theme: 'dark' })
  })

  it('ignores stored text that is not settings', () => {
    for (const stored of ['not json', '42', 'null', '[]']) {
      localStorage.setItem(key, stored)
      expect(loadSettings()).toEqual({})
    }
  })
})

describe('saving settings', () => {
  it('stores only what was chosen', () => {
    saveSettings({ theme: 'light' })
    expect(JSON.parse(localStorage.getItem(key) ?? 'null')).toEqual({ theme: 'light' })
  })

  it('stores nothing when everything follows the system', () => {
    saveSettings({ language: 'it' })
    saveSettings({})
    expect(localStorage.getItem(key)).toBeNull()
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

    localStorage.setItem(key, JSON.stringify({ theme: 'light' }))
    listeners.forEach((listener) => {
      listener()
    })
    expect(isDark()).toBe(false)
  })
})
