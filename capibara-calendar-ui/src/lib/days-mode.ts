import { z } from 'zod'

const storageKey = 'capibara-calendar-days-mode'

const daysModes = ['week', 'month'] as const

export type DaysMode = (typeof daysModes)[number]

export function loadDaysMode(): DaysMode {
  try {
    const stored = localStorage.getItem(storageKey)
    const parsed = z.enum(daysModes).safeParse(stored)
    return parsed.success ? parsed.data : 'week'
  } catch {
    return 'week'
  }
}

export function saveDaysMode(mode: DaysMode) {
  try {
    localStorage.setItem(storageKey, mode)
  } catch {
    // storage is blocked
  }
}

export const otherMode = (mode: DaysMode): DaysMode => (mode === 'week' ? 'month' : 'week')
