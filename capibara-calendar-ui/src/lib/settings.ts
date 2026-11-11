import { z } from 'zod'
import { activateLocale, detectLocale } from '../i18n'

const storageKey = 'capibara-calendar-settings'

const settingsSchema = z.object({
  language: z.enum(['en', 'it']).optional().catch(undefined),
  theme: z.enum(['light', 'dark']).optional().catch(undefined),
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
  const { language, theme } = settingsSchema.parse(settings)
  try {
    if (language ?? theme) {
      localStorage.setItem(storageKey, JSON.stringify({ language, theme }))
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

function applyTheme({ theme }: Settings) {
  const dark = theme ? theme === 'dark' : window.matchMedia(prefersDark).matches
  document.documentElement.classList.toggle('dark', dark)
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
