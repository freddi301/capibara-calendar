import { take, uniq } from 'es-toolkit'
import { z } from 'zod'

const storageKey = 'capibara-calendar-recent-colors'
const recentLimit = 5
const recentSchema = z.array(z.string().regex(/^#[0-9a-f]{6}$/))

export function recentColors(): string[] {
  try {
    const stored = localStorage.getItem(storageKey)
    const parsed = recentSchema.safeParse(stored && JSON.parse(stored))
    return parsed.success ? take(parsed.data, recentLimit) : []
  } catch {
    return []
  }
}

export function rememberColor(color: string): string[] {
  const recent = take(uniq([color.toLowerCase(), ...recentColors()]), recentLimit)
  try {
    localStorage.setItem(storageKey, JSON.stringify(recent))
  } catch {
    // storage is blocked
  }
  return recent
}
