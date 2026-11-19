import { cn } from 'cn'
import EventContent from '@/components/EventContent'
import EventMarks from '@/components/EventMarks'
import EventMenu from '@/components/EventMenu'
import { Button } from '@/components/ui/button'
import type { DisplayEvent } from '@/lib/display-event'
import { colorMark, eventBorder } from '@/lib/calendar-color'
import { borderOf, stickyHeight, textLineHeight, textLines, type Block } from '@/lib/timeline'
import { useMyParticipation } from '@/lib/use-self-ids'

type TimelineBlockProps = {
  block: Block
  left: number
  width: number
  onOpen: (event: DisplayEvent) => void
}

export default function TimelineBlock({ block, left, width, onOpen }: TimelineBlockProps) {
  const { event, top, height, real } = block
  const mine = useMyParticipation(event)
  const room = Math.min(height - 2 - borderOf(event), stickyHeight)
  return (
    <div data-slot="timeline-block" className="absolute p-px" style={{ top, height, left, width }}>
      <span aria-hidden="true" className="absolute top-px bottom-px left-px w-1 bg-muted/70" />
      <span
        aria-hidden="true"
        data-slot="timeline-duration"
        className="absolute top-px left-px w-1 bg-foreground/35"
        style={{ height: Math.min(Math.max(real, 2), height - 2 - borderOf(event)) }}
      />
      <EventMenu event={event.source}>
        <Button
          variant="ghost"
          {...colorMark}
          className={cn(
            'relative ml-1 h-full w-[calc(100%-0.25rem)] min-w-0 flex-col items-start justify-start gap-0 overflow-clip rounded-l-none rounded-r-md border-r-4 border-l-0 bg-muted/70 p-0 text-left font-normal whitespace-normal hover:bg-muted/85',
            event.eventColor && 'border-b-4',
          )}
          style={{ borderRightColor: event.color, ...eventBorder(event.eventColor) }}
          onClick={() => {
            onOpen(event)
          }}
        >
          <span
            data-slot="timeline-content"
            className="sticky top-0 block w-full overflow-clip px-2 py-1"
            style={{ height: room }}
          >
            <span
              className="block overflow-clip"
              style={{ maxHeight: textLines(room) * textLineHeight }}
            >
              <EventContent event={event} mine={mine} />
            </span>
          </span>
        </Button>
      </EventMenu>
      <EventMarks event={event} mine={mine} className="-top-2.5 right-2" />
    </div>
  )
}
