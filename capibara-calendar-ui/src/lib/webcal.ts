import { t } from '@lingui/core/macro'
import { omit } from 'es-toolkit'
import { z } from 'zod'
import { feedUrl } from '@/api/webcal/feed'
import { getStored, setStored } from './use-stored'

export const presetWebcal = import.meta.env.VITE_DEFAULT_WEBCAL_URL ?? ''

export type Webcal = { url: string; name: string; color?: string }

function isAlreadyAdded(value: string) {
  const url = feedUrl(value)
  return (
    url !== undefined &&
    Object.values(getStored().webcals).some((other) => feedUrl(other.url) === url)
  )
}

export function createWebcalSchema() {
  return z.object({
    url: z
      .string()
      .trim()
      .min(1, t`Enter the address of the Webcal`)
      .refine((value) => feedUrl(value) !== undefined, t`Enter a valid address`)
      .refine((value) => !isAlreadyAdded(value), t`This Webcal is already added`),
    name: z.string().trim(),
  })
}

export type WebcalValues = z.infer<ReturnType<typeof createWebcalSchema>>

export const nameOfFeed = (url: string) => url.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')

export function addWebcal(subscription: Webcal) {
  const id = crypto.randomUUID()
  setStored(({ webcals }) => ({ webcals: { ...webcals, [id]: subscription } }))
  return id
}

export function changeWebcal(id: string, change: Partial<Pick<Webcal, 'name' | 'color'>>) {
  setStored(({ webcals }) => {
    const found = webcals[id] as Webcal | undefined
    return found ? { webcals: { ...webcals, [id]: { ...found, ...change } } } : {}
  })
}

export function removeWebcal(id: string) {
  setStored(({ webcals }) => ({ webcals: omit(webcals, [id]) }))
}
