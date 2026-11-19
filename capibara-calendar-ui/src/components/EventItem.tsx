import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import EventContent from '@/components/EventContent'
import EventMarks from '@/components/EventMarks'
import EventMenu from '@/components/EventMenu'
import { colorBorder, colorMark, eventBorder } from '@/lib/calendar-color'
import type { DisplayEvent } from '@/lib/display-event'
import { fadeIn } from '@/lib/motion'
import { useMyParticipation } from '@/lib/use-self-ids'
import type { DayEntry } from '@/lib/week'

type EventItemProps = {
  entry: DayEntry
  onEdit: (event: DisplayEvent) => void
}

export default function EventItem({ entry: { event, start, end }, onEdit }: EventItemProps) {
  const mine = useMyParticipation(event)
  return (
    <EventMenu event={event.source}>
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
            'relative block min-w-0 flex-1 rounded-md bg-muted/50 px-2 py-1 group-hover:bg-muted/70',
            event.color && 'border-r-4',
            event.eventColor && 'border-b-4',
          )}
          style={{ ...colorBorder(event.color), ...eventBorder(event.eventColor) }}
        >
          <EventMarks event={event} mine={mine} />
          <EventContent event={event} mine={mine} start={start} end={end} />
        </span>
      </Button>
    </EventMenu>
  )
}
