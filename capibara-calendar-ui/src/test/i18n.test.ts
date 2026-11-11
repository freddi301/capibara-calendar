import { t } from '@lingui/core/macro'
import { describe, expect, it } from 'vitest'
import { activateLocale, detectLocale, i18n } from '../i18n'

describe('detectLocale', () => {
  it('picks the first supported language and ignores the region', () => {
    expect(detectLocale(['fr-FR', 'it-IT', 'en-US'])).toBe('it')
  })

  it('falls back to the source locale', () => {
    expect(detectLocale(['fr', 'de'])).toBe('en')
    expect(detectLocale([])).toBe('en')
  })
})

describe('activateLocale', () => {
  it('loads the Italian catalog', async () => {
    await activateLocale('it')
    expect(i18n.locale).toBe('it')
    expect(t`Your calendars, in one place`).toBe('I tuoi calendari, in un unico posto')
    await activateLocale('en')
  })
})
