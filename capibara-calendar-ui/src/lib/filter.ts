import { z } from 'zod'

const storageKey = 'capibara-calendar-hidden-calendars'
const hiddenSchema = z.array(z.string())

/** The calendars that are not shown, by their address. All the others are. */
export function hiddenCalendars(): string[] {
  try {
    const stored = localStorage.getItem(storageKey)
    const parsed = hiddenSchema.safeParse(stored && JSON.parse(stored))
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

export function saveHiddenCalendars(hidden: string[]) {
  try {
    if (hidden.length) localStorage.setItem(storageKey, JSON.stringify(hidden))
    else localStorage.removeItem(storageKey)
  } catch {
    // storage is blocked
  }
}
