import { useQuery } from '@tanstack/react-query'
import { listCalendars } from './caldav'
import { calendarsStaleTime } from './query-client'

export function useCalendars() {
  return useQuery({
    queryKey: ['calendars'],
    queryFn: listCalendars,
    staleTime: calendarsStaleTime,
  })
}
