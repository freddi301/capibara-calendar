import { MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { DisplayEvent } from '@/lib/display-event'
import { extrasOf } from '@/lib/event-extras'
import { useStored } from '@/lib/use-stored'

export default function EventExtras({ event }: { event: DisplayEvent }) {
  const { tags, place, description } = extrasOf(
    event,
    useStored((stored) => stored.viewOptions),
  )
  if (!tags.length && !place && !description) return null
  return (
    <span className="mt-1.5 flex flex-col gap-1 text-sm font-normal text-foreground/70">
      {tags.length > 0 && (
        <span className="flex gap-1 overflow-hidden whitespace-nowrap">
          {tags.map((tag) => (
            <Badge
              key={tag}
              variant="secondary"
              className="h-5 shrink-0 rounded-md border-border font-normal"
            >
              {tag}
            </Badge>
          ))}
        </span>
      )}
      {place && (
        <span className="flex items-center gap-1">
          <MapPin className="size-3.5 shrink-0" />
          <span className="min-w-0 truncate">{place}</span>
        </span>
      )}
      {description && <span className="line-clamp-3 break-words hyphenated">{description}</span>}
    </span>
  )
}
