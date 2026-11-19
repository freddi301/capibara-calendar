import type { DisplayEvent } from '@/lib/display-event'
import { splitTags } from './tags'
import type { Stored } from './use-stored'

export type ViewOptions = Stored['viewOptions']

export function contentOf(event: DisplayEvent, view: ViewOptions) {
  return {
    tags: view.tags ? splitTags(event.tags) : [],
    place: view.place ? event.location.trim() : '',
    statuses: view.participants ? event.source.participants.map(({ status }) => status) : [],
    description: view.description ? event.description.replace(/\s+/g, ' ').trim() : '',
  }
}

const wrappedLines = 3

const charactersPerLine = 25

const linesFor = (text: string) =>
  Math.min(wrappedLines, Math.max(1, Math.ceil(text.length / charactersPerLine)))

export function linesOf(event: DisplayEvent, view: ViewOptions) {
  const { tags, place, statuses, description } = contentOf(event, view)
  return (
    1 +
    linesFor(event.title) +
    (view.calendar ? 1 : 0) +
    (tags.length > 0 ? 1 : 0) +
    (place ? 1 : 0) +
    (statuses.length > 0 ? 1 : 0) +
    (description ? linesFor(description) : 0)
  )
}
