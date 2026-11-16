import { t } from '@lingui/core/macro'
import { omit } from 'es-toolkit'
import { z } from 'zod'
import { getStored, setStored, type Stored } from './use-stored'

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

export type Address = Pick<Connection, 'url' | 'username'>

type Kept = Stored['connections'][string]

const keptOf = (connections: Stored['connections'], id: string): Kept | undefined => connections[id]

export function loadAddressOf(id: string): Address | undefined {
  const found = keptOf(getStored().connections, id)
  return found && resolveUrl(found.url) ? { url: found.url, username: found.username } : undefined
}

export function loadConnectionOf(id: string): Connection | undefined {
  const address = loadAddressOf(id)
  const { password } = keptOf(getStored().connections, id) ?? {}
  return address && password !== undefined ? { ...address, password } : undefined
}

export const newConnectionId = () => `caldav-${crypto.randomUUID().slice(0, 8)}`

export function saveConnectionOf(id: string, connection: Connection) {
  setStored(({ connections }) => ({
    connections: { ...connections, [id]: connectionSchema.parse(connection) },
  }))
}

export function forgetPasswordOf(id: string) {
  setStored(({ connections }) => {
    const found = keptOf(connections, id)
    if (!found) return {}
    return { connections: { ...connections, [id]: { url: found.url, username: found.username } } }
  })
}

export function clearConnectionOf(id: string) {
  setStored(({ connections }) => ({ connections: omit(connections, [id]) }))
}

export const connectionIds = () =>
  Object.keys(getStored().connections)
    .filter((id) => loadAddressOf(id))
    .toSorted((a, b) => Number(b === primaryConnectionId) - Number(a === primaryConnectionId))
