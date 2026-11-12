import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import EventMarks from '@/components/EventMarks'
import TagBadges from '@/components/TagBadges'
import { Button } from '@/components/ui/button'
import type { DisplayEvent } from '@/lib/display-event'
import { colorBorder, colorMark, eventBorder } from '@/lib/calendar-color'
import { extrasOf } from '@/lib/event-extras'
import { titleStyle } from '@/lib/event-marks'
import { formatTimeRange } from '@/lib/format'
import { useViewOptions } from '@/lib/view-options'
import type { DayEntry } from '@/lib/week'

type EventCardProps = {
  entry: DayEntry
  onEdit: (event: DisplayEvent) => void
}

export default function EventCard({ entry: { event, start, end }, onEdit }: EventCardProps) {
  const { i18n } = useLingui()
  const time = formatTimeRange(start, end, i18n.locale)
  const { tags, place, description } = extrasOf(event, useViewOptions())
  const rest = [place, description].filter(Boolean).join(' · ')
  const extras = tags.length > 0 || rest
  return (
    <Button
      variant="ghost"
      {...colorMark}
      className={cn(
        'relative h-auto min-w-0 shrink-0 basis-[calc((100%-(var(--cards,2)-1)*0.375rem)/var(--cards,2))] snap-start flex-col items-start justify-start gap-0.5 rounded-md bg-muted/50 px-2 pt-2 pb-1.5 text-left font-normal whitespace-normal hover:bg-muted/70',
        event.color && 'border-l-4',
        event.eventColor && 'border-b-4',
      )}
      style={{ ...colorBorder(event.color), ...eventBorder(event.eventColor) }}
      onClick={() => {
        onEdit(event)
      }}
    >
      <EventMarks event={event} />
      {time && (
        <span className="max-w-full truncate text-sm leading-tight font-semibold text-foreground/70 tabular-nums">
          {time}
        </span>
      )}
      <span
        className={cn(
          'text-base leading-tight font-bold wrap-anywhere hyphenated',
          extras ? 'line-clamp-2' : 'line-clamp-3',
          titleStyle(event),
        )}
      >
        {event.title}
      </span>
      {extras && (
        <span className="flex w-full min-w-0 items-center gap-1 text-sm leading-tight font-normal text-foreground/70">
          {tags.length > 0 && <TagBadges tags={tags} />}
          {rest && <span className="min-w-0 flex-1 truncate">{rest}</span>}
        </span>
      )}
    </Button>
  )
}
