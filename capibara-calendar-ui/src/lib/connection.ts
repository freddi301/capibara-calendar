import { t } from '@lingui/core/macro'
import { z } from 'zod'

const storageKey = 'capibara-calendar-connection'

const connectionSchema = z.object({
  url: z.string().min(1),
  username: z.string(),
  password: z.string(),
})

export type Connection = z.infer<typeof connectionSchema>

const addressField: keyof Connection = 'url'

export function resolveUrl(value: string): string | undefined {
  try {
    const url = new URL(value.trim(), window.location.origin)
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}

const passwordKey = 'capibara-calendar-password'

const addressSchema = connectionSchema.pick({ url: true, username: true })

export type Address = z.infer<typeof addressSchema>

export function loadAddress(): Address | undefined {
  try {
    const stored = localStorage.getItem(storageKey)
    const parsed = addressSchema.safeParse(stored && JSON.parse(stored))
    if (!parsed.success || !resolveUrl(parsed.data.url)) return undefined
    const old = connectionSchema.shape.password.safeParse(
      (JSON.parse(stored ?? '{}') as Record<string, unknown>).password,
    )
    if (old.success) {
      if (sessionStorage.getItem(passwordKey) === null)
        sessionStorage.setItem(passwordKey, old.data)
      localStorage.setItem(storageKey, JSON.stringify(parsed.data))
    }
    return parsed.data
  } catch {
    return undefined
  }
}

export function loadConnection(): Connection | undefined {
  const address = loadAddress()
  try {
    const password = sessionStorage.getItem(passwordKey)
    return address && password !== null ? { ...address, password } : undefined
  } catch {
    return undefined
  }
}

export function saveConnection(connection: Connection) {
  try {
    const { password, ...address } = connectionSchema.parse(connection)
    localStorage.setItem(storageKey, JSON.stringify(address))
    sessionStorage.setItem(passwordKey, password)
  } catch {
    // storage is blocked
  }
}

export function forgetPassword() {
  try {
    sessionStorage.removeItem(passwordKey)
  } catch {
    // storage is blocked
  }
}

export function clearConnection() {
  forgetPassword()
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

export const presetUrl = import.meta.env.VITE_DEFAULT_CALDAV_URL ?? ''

export const firstField: keyof Connection = presetUrl ? 'username' : addressField
export const passwordField: keyof Connection = 'password'
