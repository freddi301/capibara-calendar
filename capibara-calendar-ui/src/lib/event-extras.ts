import type { DisplayEvent } from '@/lib/display-event'
import { splitTags } from './tags'
import type { ViewOptions } from './view-options'

export function extrasOf(event: DisplayEvent, view: ViewOptions) {
  return {
    tags: view.tags ? splitTags(event.tags) : [],
    place: view.place ? event.location.trim() : '',
    description: view.description ? event.description.replace(/\s+/g, ' ').trim() : '',
  }
}
