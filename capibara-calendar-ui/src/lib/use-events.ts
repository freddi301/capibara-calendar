import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { listEvents } from './caldav'
import { hiddenCalendars } from './filter'
import type { DateRange } from './week'

export function useEvents({ start, end }: DateRange) {
  return useQuery({
    queryKey: ['events', start, end],
    queryFn: () => listEvents({ start, end }),
    // The week or the month that was shown stays until the next one is there.
    placeholderData: keepPreviousData,
    select: (events) => {
      const hidden = hiddenCalendars()
      return events.filter(({ calendarUrl }) => !hidden.includes(calendarUrl))
    },
  })
}
