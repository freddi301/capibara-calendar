import { useSyncExternalStore } from 'react'
import { z } from 'zod'

const storageKey = 'capibara-calendar-view'
const changed = 'capibara-calendar-view-changed'

const viewOptionsSchema = z.object({
  tags: z.boolean().catch(true),
  place: z.boolean().catch(true),
  description: z.boolean().catch(true),
})

export type ViewOptions = z.infer<typeof viewOptionsSchema>

export const defaultViewOptions: ViewOptions = { tags: true, place: true, description: true }

function parse(raw: string | null): ViewOptions {
  try {
    const parsed = viewOptionsSchema.safeParse(raw && JSON.parse(raw))
    return parsed.success ? parsed.data : defaultViewOptions
  } catch {
    return defaultViewOptions
  }
}

function read() {
  try {
    return localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

export const loadViewOptions = () => parse(read())

export function saveViewOptions(options: ViewOptions) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(options))
  } catch {
    // storage is blocked
  }
  window.dispatchEvent(new Event(changed))
}

let seen: { raw: string | null; options: ViewOptions } | undefined

// The same object while the stored text is the same: what a component that watches it needs.
function snapshot() {
  const raw = read()
  if (seen?.raw !== raw) seen = { raw, options: parse(raw) }
  return seen.options
}

function subscribe(onChange: () => void) {
  window.addEventListener(changed, onChange)
  window.addEventListener('storage', onChange)
  return () => {
    window.removeEventListener(changed, onChange)
    window.removeEventListener('storage', onChange)
  }
}

export function useViewOptions() {
  return useSyncExternalStore(subscribe, snapshot, () => defaultViewOptions)
}
