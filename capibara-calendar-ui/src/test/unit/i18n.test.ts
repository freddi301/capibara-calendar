// @vitest-environment jsdom
import { t } from '@lingui/core/macro'
import { describe, expect, it } from 'vitest'
import { activateLocale, detectLocale, i18n } from '@/i18n'

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
  it('sets the language of the document, for screen readers and the browser', async () => {
    await activateLocale('it')
    expect(document.documentElement.lang).toBe('it')
    await activateLocale('en')
    expect(document.documentElement.lang).toBe('en')
  })

  it('loads the Italian catalog', async () => {
    await activateLocale('it')
    expect(i18n.locale).toBe('it')
    expect(t`Save`).toBe('Salva')
    await activateLocale('en')
  })
})
