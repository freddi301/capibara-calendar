import type { CalendarApi } from './calendar-api'
import { createRegistry } from './sources'

let current: CalendarApi | undefined

export function getApi(): CalendarApi {
  current ??= createRegistry()
  return current
}

export function setApi(api: CalendarApi | undefined) {
  current = api
}

export function resetApi() {
  current = undefined
}

export function hasSources() {
  return getApi().sources().length > 0
}
