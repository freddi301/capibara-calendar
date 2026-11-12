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

export const primaryConnectionId = 'caldav'

const extrasKey = 'capibara-calendar-extra-connections'

const extrasSchema = z.array(z.object({ id: z.string(), url: z.string(), username: z.string() }))

export type ExtraConnection = z.infer<typeof extrasSchema>[number]

function loadExtras(): ExtraConnection[] {
  try {
    const stored = localStorage.getItem(extrasKey)
    const parsed = extrasSchema.safeParse(stored ? JSON.parse(stored) : [])
    return parsed.success ? parsed.data : []
  } catch {
    return []
  }
}

function saveExtras(extras: ExtraConnection[]) {
  try {
    localStorage.setItem(extrasKey, JSON.stringify(extras))
  } catch {
    // storage is blocked
  }
}

const extraPasswordKey = (id: string) => `${passwordKey}-${id}`

export const newConnectionId = () => `caldav-${crypto.randomUUID().slice(0, 8)}`

export function loadAddressOf(id: string): Address | undefined {
  if (id === primaryConnectionId) return loadAddress()
  const found = loadExtras().find((extra) => extra.id === id)
  return found ? { url: found.url, username: found.username } : undefined
}

export function loadConnectionOf(id: string): Connection | undefined {
  if (id === primaryConnectionId) return loadConnection()
  const address = loadAddressOf(id)
  try {
    const password = sessionStorage.getItem(extraPasswordKey(id))
    return address && password !== null ? { ...address, password } : undefined
  } catch {
    return undefined
  }
}

export function saveConnectionOf(id: string, connection: Connection) {
  if (id === primaryConnectionId) {
    saveConnection(connection)
    return
  }
  const { password, ...address } = connectionSchema.parse(connection)
  saveExtras([...loadExtras().filter((extra) => extra.id !== id), { id, ...address }])
  try {
    sessionStorage.setItem(extraPasswordKey(id), password)
  } catch {
    // storage is blocked
  }
}

export function forgetPasswordOf(id: string) {
  if (id === primaryConnectionId) {
    forgetPassword()
    return
  }
  try {
    sessionStorage.removeItem(extraPasswordKey(id))
  } catch {
    // storage is blocked
  }
}

export function clearConnectionOf(id: string) {
  if (id === primaryConnectionId) {
    clearConnection()
    return
  }
  forgetPasswordOf(id)
  saveExtras(loadExtras().filter((extra) => extra.id !== id))
}

/** The ids of the connections that are saved: the first one, if it is, and the others. */
export const connectionIds = () => [
  ...(loadAddress() ? [primaryConnectionId] : []),
  ...loadExtras().map(({ id }) => id),
]
