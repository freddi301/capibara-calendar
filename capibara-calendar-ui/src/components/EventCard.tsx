import { useLingui } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'
import type { CalendarEvent } from '@/lib/caldav'
import { formatTimeRange } from '@/lib/format'
import type { DayEntry } from '@/lib/week'

type EventCardProps = {
  entry: DayEntry
  onEdit: (event: CalendarEvent) => void
}

// An event in a row: it has the height of the row, and two cards fit its width.
export default function EventCard({ entry: { event, start, end }, onEdit }: EventCardProps) {
  const { i18n } = useLingui()
  const time = formatTimeRange(start, end, i18n.locale)
  return (
    <Button
      variant="ghost"
      className="h-auto min-w-0 shrink-0 basis-[calc((100%-0.375rem)/2)] flex-col items-start justify-start gap-0.5 overflow-hidden rounded-md bg-muted/50 px-2.5 py-2 text-left font-normal whitespace-normal hover:bg-muted/70"
      onClick={() => {
        onEdit(event)
      }}
    >
      {time && (
        <span className="max-w-full truncate text-[13px] leading-tight font-semibold text-foreground/70 tabular-nums">
          {time}
        </span>
      )}
      <span className="line-clamp-2 text-base leading-tight font-bold wrap-anywhere">
        {event.title}
      </span>
    </Button>
  )
}
