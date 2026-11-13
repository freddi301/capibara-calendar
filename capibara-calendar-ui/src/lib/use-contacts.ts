import { useQuery } from '@tanstack/react-query'
import { getApi } from '@/api'
import type { Contact } from '@/api/calendar-api'
import { calendarsStaleTime } from './query-client'

export function useContacts() {
  return useQuery({
    queryKey: ['contacts'],
    queryFn: (): Promise<Contact[]> => getApi().listContacts(),
    staleTime: calendarsStaleTime,
  })
}

export function useContactNames() {
  const contacts = useContacts()
  return new Map((contacts.data ?? []).map(({ id, name }) => [String(id), name]))
}
