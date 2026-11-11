import { keepPreviousData, useQueries, useQuery } from '@tanstack/react-query'
import { listEvents, type CalendarEvent } from './caldav'
import { hiddenCalendars } from './filter'
import type { DateRange } from './week'

const eventsQuery = ({ start, end }: DateRange) => ({
  queryKey: ['events', start, end],
  queryFn: () => listEvents({ start, end }),
  placeholderData: keepPreviousData,
  select: (events: CalendarEvent[]) => {
    const hidden = hiddenCalendars()
    return events.filter(({ calendarUrl }) => !hidden.includes(calendarUrl))
  },
})

export function useEvents(range: DateRange) {
  return useQuery(eventsQuery(range))
}

const keyOf = ({ url, startDate, startTime }: CalendarEvent) => `${url} ${startDate} ${startTime}`

export function useEventPages(ranges: DateRange[]) {
  return useQueries({
    queries: ranges.map(eventsQuery),
    combine: (results) => {
      const middle = results[Math.floor(results.length / 2)]
      const seen = new Set<string>()
      const data = results
        .flatMap((result) => result.data ?? [])
        .filter((event) => !seen.has(keyOf(event)) && seen.add(keyOf(event)))
      return { data, isSuccess: middle.isSuccess, isError: middle.isError }
    },
  })
}
