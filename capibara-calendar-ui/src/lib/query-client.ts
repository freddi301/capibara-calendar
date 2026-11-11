import { QueryClient } from '@tanstack/react-query'

const minute = 60 * 1000

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
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
