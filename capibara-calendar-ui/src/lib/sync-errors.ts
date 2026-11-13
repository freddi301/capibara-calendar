import { useSyncExternalStore } from 'react'

export type SyncError = {
  key: string
  sourceId?: string
  calendarUrl?: string
  error: unknown
}

let errors: SyncError[] = []
const listeners = new Set<() => void>()

function publish(next: SyncError[]) {
  errors = next
  listeners.forEach((listener) => {
    listener()
  })
}

export const reportSyncError = (failure: SyncError) =>
  publish([...errors.filter(({ key }) => key !== failure.key), failure])

export function clearSyncError(key: string) {
  if (errors.some((failure) => failure.key === key)) {
    publish(errors.filter((failure) => failure.key !== key))
  }
}

export function clearSyncErrors() {
  if (errors.length > 0) publish([])
}

export const useSyncErrors = () =>
  useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => errors,
  )

export function trackEventsQuery(queryKey: readonly unknown[], error?: unknown) {
  const calendarUrl = queryKey[1]
  if (queryKey[0] !== 'events' || typeof calendarUrl !== 'string') return
  if (error === undefined) clearSyncError(calendarUrl)
  else reportSyncError({ key: calendarUrl, calendarUrl, error })
}
