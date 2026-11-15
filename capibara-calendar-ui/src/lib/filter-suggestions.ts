import { useQueryClient } from '@tanstack/react-query'
import { sortBy, uniq } from 'es-toolkit'
import type { Contact } from '@/api/calendar-api'
import type { DisplayEvent } from './display-event'
import type { Item } from './event-filter'

export type FilterSuggestions = { tags: Item[]; places: string[]; people: Item[] }

/**
 * What the rules can be about: the tags and the places of the events that are loaded, and the
 * contacts. The events that were not loaded are not known, so they are not offered.
 */
export function useFilterSuggestions(contacts: Contact[] | undefined): FilterSuggestions {
  const client = useQueryClient()
  const events = client
    .getQueriesData<{ events: DisplayEvent[] }>({ queryKey: ['events'] })
    .flatMap(([, chunk]) => chunk?.events ?? [])
  return {
    tags: uniq(events.flatMap(({ source }) => source.keywords))
      .sort((first, second) => first.localeCompare(second))
      .map((tag) => ({ value: tag, label: tag })),
    places: uniq(events.flatMap(({ source }) => source.locations.map(({ name }) => name))).sort(
      (first, second) => first.localeCompare(second),
    ),
    people: sortBy(contacts ?? [], ['name']).map(({ id, name }) => ({
      value: String(id),
      label: name,
    })),
  }
}
