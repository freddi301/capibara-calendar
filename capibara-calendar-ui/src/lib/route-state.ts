import type { CalendarEvent, EditScope, EventRef } from '@/api/calendar-api'
import { refOfEventKey, type CalendarInfo } from './calendars'
import type { Layout } from './layout'
import { activeTimeZone } from './settings'
import { getStored, setStored, type Stored } from './use-stored'
import { isWebxdc } from './webxdc'

export const fromExport = 'export'
export const fromImport = 'import'

export type Route =
  | { screen: 'calendar'; calendar?: CalendarInfo }
  | { screen: 'list'; date?: string }
  | {
      screen: 'event'
      event?: CalendarEvent
      ref?: EventRef
      scope?: EditScope
      from?: CalendarEvent
      copy?: CalendarEvent
      date?: string
    }
  | { screen: 'detail'; event?: CalendarEvent; ref?: EventRef; date?: string }
  | { screen: 'layouts'; date: string }
  | { screen: 'view'; date: string }
  | { screen: 'calendars' }
  | { screen: 'export' }
  | { screen: 'import' }
  | { screen: 'filters'; from?: typeof fromExport | typeof fromImport }
  | { screen: 'settings' }

export type RouteState = { route: Route; layout: Layout }

const asRoute = (route: unknown) => route as Route

const today = () => Temporal.Now.plainDateISO(activeTimeZone()).toString()

function withoutDay(route: Route): Route {
  switch (route.screen) {
    case 'list':
    case 'layouts':
    case 'view':
      return { screen: 'list' }
    case 'event':
      return route.ref ? route : { screen: 'event' }
    default:
      return route
  }
}

function routeOfLink(): Route | undefined {
  if (!isWebxdc()) return undefined
  const link = new URLSearchParams(window.location.hash.slice(1)).get('event')
  const ref = link ? refOfEventKey(link) : undefined
  return ref ? { screen: 'detail', ref } : undefined
}

export function loadRouteState(): RouteState {
  const linked = routeOfLink()
  const { route, layout, savedOn } = getStored().routeState
  const found = asRoute(route)
  return { route: linked ?? (savedOn === today() ? found : withoutDay(found)), layout }
}

/** An event is kept as a reference: it is asked for again when the screen comes back. */
function persistable(route: Route) {
  if (route.screen !== 'event' && route.screen !== 'detail') return route
  const rest: Record<string, unknown> = { ...route }
  delete rest.event
  delete rest.from
  return { ...rest, ref: route.event?.ref ?? route.ref }
}

export function saveRouteState(state: RouteState) {
  setStored({
    routeState: {
      ...state,
      route: persistable(state.route) as Stored['routeState']['route'],
      savedOn: today(),
    },
  })
}
