import { z } from 'zod'
import { defaultLayout, layouts, type Layout } from './layout'
import { activeTimeZone } from './settings'

const storageKey = 'capibara-calendar-route'

const date = z.iso.date()

const eventSchema = z.object({
  calendarUrl: z.string(),
  title: z.string(),
  description: z.string(),
  startDate: z.string(),
  startTime: z.string(),
  endDate: z.string(),
  endTime: z.string(),
  uid: z.string(),
  url: z.string(),
  etag: z.string().optional(),
  ics: z.string(),
  isRecurring: z.boolean().optional(),
  color: z.string().optional(),
})

const calendarSchema = z.object({ url: z.string(), name: z.string(), color: z.string() })

const routeSchema = z.discriminatedUnion('screen', [
  z.object({ screen: z.literal('calendar'), calendar: calendarSchema.optional() }),
  z.object({ screen: z.literal('list'), date: date.optional() }),
  z.object({ screen: z.literal('event'), event: eventSchema.optional(), date: date.optional() }),
  z.object({ screen: z.literal('layouts'), date }),
  z.object({ screen: z.literal('filter') }),
  z.object({ screen: z.literal('settings') }),
])

export type Route = z.infer<typeof routeSchema>

export type RouteState = { route: Route; layout: Layout }

const initial: RouteState = { route: { screen: 'list' }, layout: defaultLayout }

const stateSchema = z.object({
  route: routeSchema.catch(initial.route),
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
      return { screen: 'list' }
    case 'event':
      return route.event ? route : { screen: 'event' }
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
    const { route, layout, savedOn } = parsed.data
    return { route: savedOn === today() ? route : withoutDay(route), layout }
  } catch {
    return initial
  }
}

export function saveRouteState(state: RouteState) {
  try {
    localStorage.setItem(storageKey, JSON.stringify({ ...state, savedOn: today() }))
  } catch {
    // storage is blocked
  }
}
