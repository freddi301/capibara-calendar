import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import type { CalendarEvent } from '@/lib/caldav'
import { formatTimeRange } from '@/lib/format'
import type { DayEntry } from '@/lib/week'

type EventCardProps = {
  entry: DayEntry
  // Alone in its column of the lanes: it takes the height of both.
  isTall?: boolean
  onEdit: (event: CalendarEvent) => void
}

export default function EventCard({
  entry: { event, start, end },
  isTall = false,
  onEdit,
}: EventCardProps) {
  const { i18n } = useLingui()
  const time = formatTimeRange(start, end, i18n.locale)
  return (
    <Button
      variant="ghost"
      className={cn(
        'h-auto min-w-0 flex-col items-start justify-start gap-0 overflow-hidden rounded-md bg-muted/50 px-2.5 py-1 text-left font-normal whitespace-normal hover:bg-muted/70',
        isTall && 'row-span-2',
      )}
      onClick={() => {
        onEdit(event)
      }}
    >
      {time && (
        <span className="max-w-full truncate text-[13px] leading-tight font-semibold text-foreground/70 tabular-nums">
          {time}
        </span>
      )}
      <span
        className={cn(
          'text-base leading-tight font-bold wrap-anywhere',
          isTall ? 'line-clamp-2' : 'line-clamp-1',
        )}
      >
        {event.title}
      </span>
    </Button>
  )
}
