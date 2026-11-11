import { z } from 'zod'
import { activateLocale, detectLocale } from '../i18n'

const storageKey = 'capibara-calendar-settings'

function isTimeZone(value: string) {
  try {
    Temporal.Now.zonedDateTimeISO(value)
    return true
  } catch {
    return false
  }
}

const settingsSchema = z.object({
  language: z.enum(['en', 'it']).optional().catch(undefined),
  theme: z.enum(['light', 'dark']).optional().catch(undefined),
  timeZone: z.string().refine(isTimeZone).optional().catch(undefined),
  weekStart: z.enum(['monday', 'saturday', 'sunday']).optional().catch(undefined),
})

export type Settings = z.infer<typeof settingsSchema>

export function loadSettings(): Settings {
  try {
    const stored = localStorage.getItem(storageKey)
    const parsed = settingsSchema.safeParse(stored && JSON.parse(stored))
    return parsed.success ? parsed.data : {}
  } catch {
    return {}
  }
}

export function saveSettings(settings: Settings) {
  const valid = settingsSchema.parse(settings)
  try {
    if (Object.values(valid).some(Boolean)) {
      localStorage.setItem(storageKey, JSON.stringify(valid))
    } else {
      localStorage.removeItem(storageKey)
    }
  } catch {
    // storage is blocked
  }
}

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
    applyTheme(loadSettings())
  })
}

export function activeTimeZone() {
  return loadSettings().timeZone ?? Temporal.Now.timeZoneId()
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
  const chosen = loadSettings().weekStart
  return chosen ? firstDays[chosen] : systemWeekStart()
}

export const timeZones = Array.from(new Set(['UTC', ...Intl.supportedValuesOf('timeZone')]))
