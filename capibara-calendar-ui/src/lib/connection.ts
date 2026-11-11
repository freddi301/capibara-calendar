import { t } from '@lingui/core/macro'
import { z } from 'zod'

const storageKey = 'capibara-calendar-connection'

const connectionSchema = z.object({
  url: z.string().min(1),
  username: z.string(),
  password: z.string(),
})

export type Connection = z.infer<typeof connectionSchema>

export const addressField: keyof Connection = 'url'

export function resolveUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim(), window.location.origin)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

export function loadConnection(): Connection | undefined {
  try {
    const stored = localStorage.getItem(storageKey)
    const parsed = connectionSchema.safeParse(stored && JSON.parse(stored))
    return parsed.success && resolveUrl(parsed.data.url) ? parsed.data : undefined
  } catch {
    return undefined
  }
}

export function saveConnection(connection: Connection) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(connectionSchema.parse(connection)))
  } catch {
    // storage is blocked
  }
}

export function clearConnection() {
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // storage is blocked
  }
}

export function createConnectionSchema() {
  return z.object({
    url: z
      .string()
      .trim()
      .min(1, t`Enter the address of the server`)
      .refine((value) => resolveUrl(value) !== undefined, t`Enter a valid address`),
    username: z.string().trim(),
    password: z.string(),
  })
}
