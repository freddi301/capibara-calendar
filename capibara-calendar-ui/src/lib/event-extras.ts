import type { DisplayEvent } from '@/lib/display-event'
import { splitTags } from './tags'
import type { Stored } from './use-stored'

export function extrasOf(event: DisplayEvent, view: Stored['viewOptions']) {
  return {
    tags: view.tags ? splitTags(event.tags) : [],
    place: view.place ? event.location.trim() : '',
    description: view.description ? event.description.replace(/\s+/g, ' ').trim() : '',
  }
}
