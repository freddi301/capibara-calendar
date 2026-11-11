import type { QueryClient } from '@tanstack/react-query'
import { calendarStamp, listEvents, type CalendarEvent } from './caldav'
import { eventsStaleTime, stampStaleTime } from './query-client'
import type { DateRange } from './week'

type Chunk = { stamp: string; events: CalendarEvent[] }

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

export const chunkQuery = (client: QueryClient, calendarUrl: string, month: string) => ({
  queryKey: eventsKey(calendarUrl, month),
  staleTime: eventsStaleTime,
  refetchOnWindowFocus: 'always' as const,
  queryFn: async (): Promise<Chunk> => {
    const stamp =
      (await client.query({
        queryKey: stampKey(calendarUrl),
        queryFn: async () => (await calendarStamp(calendarUrl)) ?? '',
        staleTime: stampStaleTime,
      })) || ''
    const kept = client.getQueryData<Chunk>(eventsKey(calendarUrl, month))
    if (kept && stamp && kept.stamp === stamp) return kept
    return { stamp, events: await listEvents(calendarUrl, monthRange(month)) }
  },
})

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
