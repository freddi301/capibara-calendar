import { useQuery } from '@tanstack/react-query'
import { getApi } from '@/api'
import type { SourceId, SourceKind } from '@/api/calendar-api'
import type { DisplayEvent } from './display-event'
import { myParticipant } from './event-actions'
import { useCalendars } from './use-calendars'

const hour = 60 * 60 * 1000

export function useSelfIds(kind: SourceKind | undefined, sourceId: SourceId) {
  const asked = useQuery({
    queryKey: ['self', sourceId],
    queryFn: () => getApi().selfAddresses(sourceId),
    enabled: kind === 'caldav',
    staleTime: hour,
  })
  if (kind === 'webxdc') {
    const address = window.webxdc?.selfAddr
    return address ? [address.toLowerCase()] : []
  }
  return asked.data ?? []
}

export function useMyParticipation({ calendarKey, source }: DisplayEvent) {
  const calendars = useCalendars()
  const kind = calendars.data?.find(({ url }) => url === calendarKey)?.sourceKind
  const selfIds = useSelfIds(kind, source.ref.sourceId)
  return myParticipant(source.participants, selfIds)?.status
}
