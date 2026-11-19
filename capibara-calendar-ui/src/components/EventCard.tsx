import { cn } from 'cn'
import type { ComponentProps } from 'react'
import EventContent from '@/components/EventContent'
import EventMarks from '@/components/EventMarks'
import EventMenu from '@/components/EventMenu'
import { Button } from '@/components/ui/button'
import type { DisplayEvent } from '@/lib/display-event'
import { colorBorder, colorMark, eventBorder } from '@/lib/calendar-color'
import { dayFill, type DayEntry } from '@/lib/week'
import { useMyParticipation } from '@/lib/use-self-ids'

type EventCardProps = Omit<ComponentProps<typeof Button>, 'onClick' | 'children' | 'style'> & {
  entry: DayEntry
  onEdit: (event: DisplayEvent) => void
  look?: string
  isMoving?: boolean
  transitionName?: string
  menu?: { isOpen: boolean; onClose: () => void }
}

export default function EventCard({
  entry,
  onEdit,
  look,
  isMoving,
  transitionName,
  menu,
  className,
  ...props
}: EventCardProps) {
  const { event, start, end } = entry
  const fill = dayFill(entry)
  const mine = useMyParticipation(event)
  return (
    <EventMenu event={event.source} isOpen={menu?.isOpen} onClose={menu?.onClose}>
      <Button
        variant="ghost"
        {...colorMark}
        {...props}
        className={cn(
          'relative h-auto min-w-0 shrink-0 basis-[calc((100%-(var(--cards,2)-1)*0.375rem)/var(--cards,2))] snap-start flex-col items-start justify-start gap-0 rounded-l-none rounded-r-md border-l-0 bg-muted/50 px-2 py-1 text-left font-normal whitespace-normal hover:bg-muted/70',
          event.color && 'border-r-4',
          event.eventColor && 'border-b-4',
          look,
          isMoving && 'opacity-50',
          className,
        )}
        style={{
          ...colorBorder(event.color),
          ...eventBorder(event.eventColor),
          ...(transitionName ? { viewTransitionName: transitionName } : undefined),
        }}
        onClick={() => {
          onEdit(event)
        }}
      >
        <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1">
          <span
            data-slot="day-duration"
            className="absolute inset-x-0 min-h-0.5 bg-foreground/35"
            style={{ top: `${fill.top * 100}%`, height: `${fill.height * 100}%` }}
          />
        </span>
        <EventMarks event={event} mine={mine} />
        <EventContent event={event} mine={mine} start={start} end={end} />
      </Button>
    </EventMenu>
  )
}
