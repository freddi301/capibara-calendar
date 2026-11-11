import { z } from 'zod'
import { defaultLayout, layouts, type Layout } from './layout'

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
})

const routeSchema = z.discriminatedUnion('screen', [
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
  layout: z.enum(layouts).catch(defaultLayout),
})

/** Where the person was, as they left it: the screen, the day it showed and the layout. */
export function loadRouteState(): RouteState {
  try {
    const stored = localStorage.getItem(storageKey)
    const parsed = stateSchema.safeParse(stored && JSON.parse(stored))
    return parsed.success ? parsed.data : initial
  } catch {
    return initial
  }
}

export function saveRouteState(state: RouteState) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state))
  } catch {
    // storage is blocked
  }
}
