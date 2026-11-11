import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import EventMarks from '@/components/EventMarks'
import { Button } from '@/components/ui/button'
import type { CalendarEvent } from '@/lib/caldav'
import { colorBorder, colorMark } from '@/lib/calendar-color'
import { extrasOf } from '@/lib/event-extras'
import { formatTimeRange } from '@/lib/format'
import { useViewOptions } from '@/lib/view-options'
import type { DayEntry } from '@/lib/week'

type EventCardProps = {
  entry: DayEntry
  onEdit: (event: CalendarEvent) => void
}

export default function EventCard({ entry: { event, start, end }, onEdit }: EventCardProps) {
  const { i18n } = useLingui()
  const time = formatTimeRange(start, end, i18n.locale)
  const { tags, place, description } = extrasOf(event, useViewOptions())
  const extras = [tags.join(', '), place, description].filter(Boolean).join(' · ')
  return (
    <Button
      variant="ghost"
      {...colorMark}
      className={cn(
        'relative h-auto min-w-0 shrink-0 basis-[calc((100%-0.375rem)/2)] flex-col items-start justify-start gap-0.5 rounded-md bg-muted/50 px-2 pt-2 pb-1.5 text-left font-normal whitespace-normal hover:bg-muted/70',
        event.color && 'border-l-4',
      )}
      style={colorBorder(event.color)}
      onClick={() => {
        onEdit(event)
      }}
    >
      <EventMarks event={event} />
      {time && (
        <span className="max-w-full truncate text-[13px] leading-tight font-semibold text-foreground/70 tabular-nums">
          {time}
        </span>
      )}
      <span
        className={cn(
          'text-base leading-tight font-bold wrap-anywhere hyphenated',
          extras ? 'line-clamp-2' : 'line-clamp-3',
        )}
      >
        {event.title}
      </span>
      {extras && (
        <span className="w-full truncate text-xs leading-tight font-normal text-foreground/70">
          {extras}
        </span>
      )}
    </Button>
  )
}
