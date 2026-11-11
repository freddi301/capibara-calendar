import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import type { CalendarEvent } from '@/lib/caldav'
import { colorBorder, colorMark } from '@/lib/calendar-color'
import { formatTimeRange } from '@/lib/format'
import type { DayEntry } from '@/lib/week'

type EventCardProps = {
  entry: DayEntry
  onEdit: (event: CalendarEvent) => void
}

export default function EventCard({ entry: { event, start, end }, onEdit }: EventCardProps) {
  const { i18n } = useLingui()
  const time = formatTimeRange(start, end, i18n.locale)
  return (
    <Button
      variant="ghost"
      {...colorMark}
      className={cn(
        'h-auto min-w-0 shrink-0 basis-[calc((100%-0.375rem)/2)] flex-col items-start justify-start gap-0.5 overflow-hidden rounded-md bg-muted/50 px-2 py-1.5 text-left font-normal whitespace-normal hover:bg-muted/70',
        event.color && 'border-l-4',
      )}
      style={colorBorder(event.color)}
      onClick={() => {
        onEdit(event)
      }}
    >
      {time && (
        <span className="max-w-full truncate text-[13px] leading-tight font-semibold text-foreground/70 tabular-nums">
          {time}
        </span>
      )}
      <span className="line-clamp-3 text-base leading-tight font-bold wrap-anywhere">
        {event.title}
      </span>
    </Button>
  )
}
