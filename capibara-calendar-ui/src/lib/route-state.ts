import { z } from 'zod'
import { fullRights } from '@/api/calendar-api'
import type { CalendarEvent, EditScope, EventRef } from '@/api/calendar-api'
import type { CalendarInfo } from './calendars'
import { defaultLayout, layouts, type Layout } from './layout'
import { activeTimeZone } from './settings'

const storageKey = 'capibara-calendar-route'

const date = z.iso.date()

const refSchema = z.object({
  sourceId: z.string(),
  calendarId: z.string(),
  eventId: z.string(),
  recurrenceId: z.string().optional(),
})

const calendarSchema = z.object({
  url: z.string(),
  name: z.string(),
  color: z.string(),
  rights: z
    .object({ create: z.boolean(), update: z.boolean(), remove: z.boolean() })
    .default(fullRights),
  ref: z.object({ sourceId: z.string(), calendarId: z.string() }),
  sourceKind: z.enum(['caldav', 'local', 'memory']),
  sourceName: z.string(),
})

const asDetail = (route: unknown) => {
  if (typeof route !== 'object' || route === null) return route
  const old = route as { screen?: unknown; readOnly?: unknown; ref?: unknown }
  if (old.screen !== 'event' || old.readOnly !== true) return route
  const rest: Record<string, unknown> = { ...old }
  delete rest.readOnly
  return old.ref ? { ...rest, screen: 'detail' } : rest
}

const routeSchema = z.preprocess(
  asDetail,
  z.discriminatedUnion('screen', [
    z.object({ screen: z.literal('calendar'), calendar: calendarSchema.optional() }),
    z.object({ screen: z.literal('list'), date: date.optional() }),
    z.object({
      screen: z.literal('event'),
      ref: refSchema.optional(),
      scope: z.enum(['one', 'following', 'all']).optional(),
      date: date.optional(),
    }),
    z.object({ screen: z.literal('detail'), ref: refSchema, date: date.optional() }),
    z.object({ screen: z.literal('layouts'), date }),
    z.object({ screen: z.literal('view'), date }),
    z.object({ screen: z.literal('filter') }),
    z.object({ screen: z.literal('settings') }),
  ]),
)

export type Route =
  | { screen: 'calendar'; calendar?: CalendarInfo }
  | { screen: 'list'; date?: string }
  | {
      screen: 'event'
      event?: CalendarEvent
      ref?: EventRef
      scope?: EditScope
      from?: CalendarEvent
      date?: string
    }
  | { screen: 'detail'; event?: CalendarEvent; ref?: EventRef; date?: string }
  | { screen: 'layouts'; date: string }
  | { screen: 'view'; date: string }
  | { screen: 'filter' }
  | { screen: 'settings' }

export type RouteState = { route: Route; layout: Layout }

const asRoute = (route: unknown) => route as Route

const initial: RouteState = { route: { screen: 'list' }, layout: defaultLayout }

const stateSchema = z.object({
  route: routeSchema.catch({ screen: 'list' as const }),
  layout: z
    .preprocess(
      (value) => (value === 'week' || value === 'month' ? 'days' : value),
      z.enum(layouts),
    )
    .catch(defaultLayout),
  savedOn: date.optional().catch(undefined),
})

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

/** Where the person was, as they left it: the screen, the day it showed and the layout. */
export function loadRouteState(): RouteState {
  try {
    const stored = localStorage.getItem(storageKey)
    const parsed = stateSchema.safeParse(stored && JSON.parse(stored))
    if (!parsed.success) return initial
    const { layout, savedOn } = parsed.data
    const route = asRoute(parsed.data.route)
    return { route: savedOn === today() ? route : withoutDay(route), layout }
  } catch {
    return initial
  }
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
  try {
    localStorage.setItem(
      storageKey,
      JSON.stringify({ ...state, route: persistable(state.route), savedOn: today() }),
    )
  } catch {
    // storage is blocked
  }
}
