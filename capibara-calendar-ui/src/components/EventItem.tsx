import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import EventExtras from '@/components/EventExtras'
import EventMarks from '@/components/EventMarks'
import { colorBorder, colorMark, eventBorder } from '@/lib/calendar-color'
import type { DisplayEvent } from '@/lib/display-event'
import { titleStyle } from '@/lib/event-marks'
import { formatTime } from '@/lib/format'
import { fadeIn } from '@/lib/motion'
import type { DayEntry } from '@/lib/week'

type EventItemProps = {
  entry: DayEntry
  onEdit: (event: DisplayEvent) => void
}

export default function EventItem({ entry: { event, start, end }, onEdit }: EventItemProps) {
  const { i18n } = useLingui()
  return (
    <Button
      variant="ghost"
      className={cn(
        'group h-auto w-full shrink-0 items-stretch justify-start gap-2 p-0 text-left font-normal whitespace-normal hover:bg-transparent dark:hover:bg-transparent',
        fadeIn,
      )}
      onClick={() => {
        onEdit(event)
      }}
    >
      <span
        {...colorMark}
        className={cn(
          'relative flex min-w-0 flex-1 items-start gap-3 rounded-md bg-muted/50 px-3 py-2.5 text-base font-bold break-words hyphenated group-hover:bg-muted/70',
          event.color && 'border-r-4',
          event.eventColor && 'border-b-4',
        )}
        style={{ ...colorBorder(event.color), ...eventBorder(event.eventColor) }}
      >
        <EventMarks event={event} />
        <span className="min-w-0 flex-1">
          <span className={titleStyle(event)}>{event.title}</span>
          <EventExtras event={event} />
        </span>
        {(start || end) && (
          <span className="flex shrink-0 flex-col text-right text-sm leading-snug font-normal tabular-nums">
            {start && <span className="font-semibold">{formatTime(start, i18n.locale)}</span>}
            {end && <span className="text-foreground/70">{formatTime(end, i18n.locale)}</span>}
          </span>
        )}
      </span>
    </Button>
  )
}
