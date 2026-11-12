import { useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'

const isServerQuery = (key: readonly unknown[]) => key[0] === 'events' || key[0] === 'calendars'

export function useHasServerError() {
  const cache = useQueryClient().getQueryCache()
  return useSyncExternalStore(
    (onChange) => cache.subscribe(onChange),
    () =>
      cache.findAll({
        predicate: ({ queryKey, state }) => state.status === 'error' && isServerQuery(queryKey),
      }).length > 0,
  )
}
