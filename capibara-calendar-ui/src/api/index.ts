import type { CalendarApi } from './calendar-api'
import { createRegistry } from './sources'

let current: CalendarApi | undefined
let stopListening: (() => void) | undefined
const listeners = new Set<() => void>()

function adopt(api: CalendarApi | undefined) {
  stopListening?.()
  current = api
  stopListening = api?.subscribe(() => {
    listeners.forEach((listener) => {
      listener()
    })
  })
}

export function getApi(): CalendarApi {
  if (!current) adopt(createRegistry())
  return current as CalendarApi
}

export function setApi(api: CalendarApi | undefined) {
  adopt(api)
}

export function resetApi() {
  adopt(undefined)
}

export function hasSources() {
  return getApi().sources().length > 0
}

export function onSourcesChanged(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}
