import { MapPin } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { CalendarEvent } from '@/lib/caldav'
import { extrasOf } from '@/lib/event-extras'
import { useViewOptions } from '@/lib/view-options'

export default function EventExtras({ event }: { event: CalendarEvent }) {
  const { tags, place, description } = extrasOf(event, useViewOptions())
  if (!tags.length && !place && !description) return null
  return (
    <span className="mt-1.5 flex flex-col gap-1 text-sm font-normal text-foreground/70">
      {tags.length > 0 && (
        <span className="flex flex-wrap gap-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="h-5 rounded-md font-normal">
              {tag}
            </Badge>
          ))}
        </span>
      )}
      {place && (
        <span className="flex items-start gap-1">
          <MapPin className="mt-0.5 size-3.5 shrink-0" />
          <span className="line-clamp-2 min-w-0 break-words hyphenated">{place}</span>
        </span>
      )}
      {description && <span className="line-clamp-3 break-words hyphenated">{description}</span>}
    </span>
  )
}
