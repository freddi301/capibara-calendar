import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query'
import { trackEventsQuery } from './sync-errors'
import { notifyIfUnauthorized } from './unauthorized'

const minute = 60 * 1000

export function createQueryClient() {
  return new QueryClient({
    queryCache: new QueryCache({
      onError: (error, query) => {
        notifyIfUnauthorized(error)
        trackEventsQuery(query.queryKey, error)
      },
      onSuccess: (_data, query) => {
        trackEventsQuery(query.queryKey)
      },
    }),
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        if (!mutation.meta?.isTrial) notifyIfUnauthorized(error)
      },
    }),
    defaultOptions: {
      mutations: { networkMode: 'always' },
      queries: {
        staleTime: 2 * minute,
        gcTime: 30 * minute,
        retry: 1,
      },
    },
  })
}

export const calendarsStaleTime = 30 * minute

export const eventsStaleTime = 10 * minute
export const stampStaleTime = 10 * 1000
