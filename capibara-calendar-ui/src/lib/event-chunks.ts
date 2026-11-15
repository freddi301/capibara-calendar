import type { QueryClient } from '@tanstack/react-query'
import { getApi } from '@/api'
import { eventKey, isoDate, timeZoneId, type EventRef } from '@/api/calendar-api'
import type { CalendarInfo } from './calendars'
import { refOfKey } from './calendars'
import { toDisplayEvent, type DisplayEvent } from './display-event'
import { eventsStaleTime, stampStaleTime } from './query-client'
import { activeTimeZone } from './settings'
import type { DateRange } from './week'

type Chunk = { stamp: string; events: DisplayEvent[] }

export const eventQueryKey = (ref?: EventRef) => ['event', ref ? eventKey(ref) : '']

const monthOf = (date: string) => Temporal.PlainDate.from(date).toPlainYearMonth().toString()

export const shiftMonth = (month: string, months: number) =>
  Temporal.PlainYearMonth.from(month).add({ months }).toString()

function monthRange(month: string): DateRange {
  const first = Temporal.PlainYearMonth.from(month).toPlainDate({ day: 1 })
  return { start: first.toString(), end: first.with({ day: first.daysInMonth }).toString() }
}

export function monthsOf(ranges: DateRange[]) {
  const months = new Set<string>()
  for (const { start, end } of ranges) {
    for (let month = monthOf(start); month <= monthOf(end); month = shiftMonth(month, 1)) {
      months.add(month)
    }
  }
  return [...months].sort()
}

const eventsKey = (calendarUrl?: string, month?: string) =>
  ['events', calendarUrl, month].filter((part) => part !== undefined)
const stampKey = (calendarUrl?: string) =>
  ['stamp', calendarUrl].filter((part) => part !== undefined)

async function stampOf(calendarUrl: string, color: string) {
  try {
    const revision = await getApi().revision(refOfKey(calendarUrl))
    if (!revision) return ''
    return [revision, activeTimeZone(), color].join(' ')
  } catch {
    return '' // the events say what is wrong, when they are asked for
  }
}

export const chunkQuery = (client: QueryClient, calendarUrl: string, month: string) => {
  const color =
    client.getQueryData<CalendarInfo[]>(['calendars'])?.find(({ url }) => url === calendarUrl)
      ?.color ?? ''
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return {
    queryKey: eventsKey(calendarUrl, month),
    staleTime: eventsStaleTime,
    refetchOnWindowFocus: 'always' as const,
    queryFn: async (): Promise<Chunk> => {
      const askStamp = () =>
        client.query({
          queryKey: [...stampKey(calendarUrl), color],
          queryFn: () => stampOf(calendarUrl, color),
          staleTime: stampStaleTime,
        })
      const zone = timeZoneId(activeTimeZone())
      const { start, end } = monthRange(month)
      const askEvents = () =>
        getApi().listEvents(
          refOfKey(calendarUrl),
          { start: isoDate(start), end: isoDate(end) },
          { timeZone: zone },
        )
      const kept = client.getQueryData<Chunk>(eventsKey(calendarUrl, month))
      if (!kept) {
        const [stamp, events] = await Promise.all([askStamp(), askEvents()])
        return { stamp, events: events.map((event) => toDisplayEvent(event, zone)) }
      }
      const stamp = await askStamp()
      if (stamp && kept.stamp === stamp) return kept
      const events = await askEvents()
      return { stamp, events: events.map((event) => toDisplayEvent(event, zone)) }
    },
  }
}

export function monthsBetween(days: string[]) {
  const sorted = days.filter(Boolean).sort()
  if (!sorted.length) return []
  return monthsOf([{ start: sorted[0], end: sorted[sorted.length - 1] }])
}

export function refreshEvents(client: QueryClient, calendarUrls?: string[], months?: string[]) {
  const urls = calendarUrls ?? [undefined]
  return Promise.all(
    urls.flatMap((url) =>
      (months ?? [undefined]).map(async (month) => {
        await client.invalidateQueries({ queryKey: stampKey(url) })
        client.setQueriesData<Chunk>({ queryKey: eventsKey(url, month) }, (kept) =>
          kept ? { ...kept, stamp: '' } : kept,
        )
        await client.invalidateQueries({ queryKey: eventsKey(url, month) })
      }),
    ),
  )
}
