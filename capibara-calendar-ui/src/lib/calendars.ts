import {
  calendarId,
  calendarKey,
  sourceId,
  type ApiError,
  type CalendarRef,
  type CalendarRights,
  type SourceKind,
} from '@/api/calendar-api'
import { getApi } from '@/api'

export type CalendarInfo = {
  url: string
  name: string
  color: string
  rights: CalendarRights
  ref: CalendarRef
  sourceKind: SourceKind
  sourceName: string
}

export type SourceGroup = {
  sourceId: string
  name: string
  kind: SourceKind
  calendars: CalendarInfo[]
}

export function groupBySource(calendars: CalendarInfo[]): SourceGroup[] {
  const groups = new Map<string, SourceGroup>()
  for (const calendar of calendars) {
    const id: string = calendar.ref.sourceId
    const group = groups.get(id) ?? {
      sourceId: id,
      name: calendar.sourceName,
      kind: calendar.sourceKind,
      calendars: [],
    }
    group.calendars.push(calendar)
    groups.set(id, group)
  }
  return [...groups.values()]
}

export const isReadOnly = ({ create, update, remove }: CalendarRights) =>
  !create && !update && !remove

export const refOfKey = (key: string): CalendarRef => {
  const slash = key.indexOf('/')
  return { sourceId: sourceId(key.slice(0, slash)), calendarId: calendarId(key.slice(slash + 1)) }
}

export async function listCalendars(): Promise<CalendarInfo[]> {
  const api = getApi()
  const sources = api.sources()
  const results = await api.listCalendars()
  const failed = results.filter(
    (result): result is { sourceId: typeof result.sourceId; error: ApiError } => 'error' in result,
  )
  const calendars = results.flatMap((result) => {
    if ('error' in result) return []
    const source = sources.find(({ id }) => id === result.sourceId)
    return result.calendars.map((calendar): CalendarInfo => ({
      url: calendarKey(calendar.ref),
      name: calendar.name,
      color: calendar.color,
      rights: calendar.rights,
      ref: calendar.ref,
      sourceKind: source?.kind ?? 'caldav',
      sourceName: source?.name ?? '',
    }))
  })
  if (failed.length === results.length && failed.length > 0) throw failed[0].error
  return calendars
}
