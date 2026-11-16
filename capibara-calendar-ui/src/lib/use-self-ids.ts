import { useQuery } from '@tanstack/react-query'
import { getApi } from '@/api'
import type { SourceId, SourceKind } from '@/api/calendar-api'

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
