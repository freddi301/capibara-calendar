import { i18n, type Messages } from '@lingui/core'

const sourceLocale = 'en'
const locales = { en: 'English', it: 'Italiano' } as const
export type Locale = keyof typeof locales

function isLocale(value: string): value is Locale {
  return value in locales
}

export function detectLocale(preferred: readonly string[] = navigator.languages): Locale {
  for (const tag of preferred) {
    const language = tag.split('-')[0].toLowerCase()
    if (isLocale(language)) return language
  }
  return sourceLocale
}

export async function activateLocale(locale: Locale) {
  const { messages } = (await import(`./locales/${locale}/messages.po`)) as { messages: Messages }
  i18n.loadAndActivate({ locale, messages })
}

export { i18n }
