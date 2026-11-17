import { isEqual } from 'es-toolkit'
import { useSyncExternalStore } from 'react'
import { z } from 'zod'
import { fullRights } from '@/api/calendar-api'
import {
  arityOf,
  emptyFilter,
  fields,
  groupModes,
  type FilterNode,
  type Group,
  type Rule,
} from './event-filter'
import { defaultLayout, layouts } from './layout'

const storageKey = 'capibara-calendar'

function isTimeZone(value: string) {
  try {
    Temporal.Now.zonedDateTimeISO(value)
    return true
  } catch {
    return false
  }
}

export const settingsSchema = z.object({
  language: z.enum(['en', 'it']).optional().catch(undefined),
  theme: z.enum(['light', 'dark']).optional().catch(undefined),
  timeZone: z.string().refine(isTimeZone).optional().catch(undefined),
  weekStart: z.enum(['monday', 'saturday', 'sunday']).optional().catch(undefined),
})

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
  sourceKind: z.enum(['caldav', 'local', 'memory', 'webxdc', 'webcal']),
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
    z.object({ screen: z.literal('calendars') }),
    z.object({ screen: z.literal('export') }),
    z.object({ screen: z.literal('import') }),
    z.object({ screen: z.literal('filters'), from: z.enum(['export', 'import']).optional() }),
    z.object({ screen: z.literal('settings') }),
  ]),
)

const ruleSchema = z.object({
  id: z.string(),
  kind: z.literal('rule'),
  field: z.enum(fields),
  operator: z.string(),
  text: z.string(),
  items: z.array(z.object({ value: z.string(), label: z.string() })),
  answer: z.enum(['', 'needs-action', 'accepted', 'declined', 'tentative']),
})

const groupSchema: z.ZodType<Group> = z.lazy(() =>
  z.object({
    id: z.string(),
    kind: z.literal('group'),
    mode: z.enum(groupModes),
    children: z.array(z.union([ruleSchema, groupSchema])),
  }),
)

function cleaned(group: Group): Group {
  const children = group.children.flatMap((child): FilterNode[] => {
    if (child.kind === 'group') return [cleaned(child)]
    const rule: Rule = child
    return arityOf(rule.field, rule.operator) ? [rule] : []
  })
  return { ...group, children }
}

const storedSchema = z.looseObject({
  settings: settingsSchema.catch({}),
  daysMode: z.enum(['week', 'month']).catch('week'),
  hiddenCalendars: z.array(z.string()).catch([]),
  recentColors: z.array(z.string().regex(/^#[0-9a-f]{6}$/)).catch([]),
  viewOptions: z
    .object({
      tags: z.boolean().catch(true),
      place: z.boolean().catch(true),
      description: z.boolean().catch(true),
    })
    .catch({ tags: true, place: true, description: true }),
  eventFilter: groupSchema.transform(cleaned).catch(() => emptyFilter()),
  sources: z
    .object({
      memory: z.boolean().catch(false),
      local: z.boolean().catch(false),
    })
    .catch({ memory: false, local: false }),
  connections: z
    .record(
      z.string(),
      z.object({
        url: z.string().min(1),
        username: z.string(),
        password: z.string().optional(),
      }),
    )
    .catch({}),
  webcals: z
    .record(
      z.string(),
      z.object({
        url: z.string().min(1),
        name: z.string(),
        color: z.string().optional(),
      }),
    )
    .catch({}),
  routeState: z
    .object({
      route: routeSchema.catch({ screen: 'list' as const }),
      layout: z
        .preprocess(
          (value) => (value === 'week' || value === 'month' ? 'days' : value),
          z.enum(layouts),
        )
        .catch(defaultLayout),
      savedOn: date.optional().catch(undefined),
    })
    .catch({ route: { screen: 'list' as const }, layout: defaultLayout }),
})

export type Stored = z.infer<typeof storedSchema>

function parse(raw: string | null): Stored {
  try {
    return storedSchema.parse(raw ? JSON.parse(raw) : {})
  } catch {
    return storedSchema.parse({})
  }
}

function read() {
  try {
    return localStorage.getItem(storageKey)
  } catch {
    return null
  }
}

let seen: { raw: string | null; stored: Stored } | undefined

export function getStored(): Stored {
  const raw = read()
  if (seen?.raw !== raw) {
    const next = parse(raw)
    const before = seen?.stored
    const stored = before
      ? (Object.fromEntries(
          Object.entries(next).map(([key, part]) => [
            key,
            isEqual(before[key], part) ? before[key] : part,
          ]),
        ) as Stored)
      : next
    seen = { raw, stored }
  }
  return seen.stored
}

const listeners = new Set<() => void>()

export function setStored(change: Partial<Stored> | ((current: Stored) => Partial<Stored>)) {
  const current = getStored()
  const patch = typeof change === 'function' ? change(current) : change
  try {
    localStorage.setItem(storageKey, JSON.stringify({ ...current, ...patch }))
  } catch {
    // storage is blocked
  }
  listeners.forEach((listener) => {
    listener()
  })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

export function useStored<T>(select: (stored: Stored) => T): T {
  return useSyncExternalStore(subscribe, () => select(getStored()))
}
