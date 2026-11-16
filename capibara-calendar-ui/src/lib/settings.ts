import { activateLocale, detectLocale } from '../i18n'
import { getStored, settingsSchema, type Stored } from './use-stored'

export type Settings = Stored['settings']

export function setChoice(settings: Settings, key: keyof Settings, choice: string): Settings {
  return settingsSchema.parse({ ...settings, [key]: choice === 'system' ? undefined : choice })
}

const prefersDark = '(prefers-color-scheme: dark)'

export function systemTheme() {
  return window.matchMedia(prefersDark).matches ? 'dark' : 'light'
}

function applyTheme({ theme }: Settings) {
  document.documentElement.classList.toggle('dark', (theme ?? systemTheme()) === 'dark')
}

export async function applySettings(settings: Settings) {
  applyTheme(settings)
  await activateLocale(settings.language ?? detectLocale())
}

export function watchSystemTheme() {
  window.matchMedia(prefersDark).addEventListener('change', () => {
    applyTheme(getStored().settings)
  })
}

export function activeTimeZone() {
  return getStored().settings.timeZone ?? Temporal.Now.timeZoneId()
}

const firstDays = { monday: 1, saturday: 6, sunday: 7 } as const

export function systemWeekStart() {
  try {
    return new Intl.Locale(navigator.language).getWeekInfo().firstDay
  } catch {
    return 1
  }
}

export function activeWeekStart() {
  const chosen = getStored().settings.weekStart
  return chosen ? firstDays[chosen] : systemWeekStart()
}

export const timeZones = Array.from(new Set(['UTC', ...Intl.supportedValuesOf('timeZone')]))
