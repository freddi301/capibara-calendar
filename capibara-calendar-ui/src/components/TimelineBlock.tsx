import { useLingui } from '@lingui/react/macro'
import { Button } from '@/components/ui/button'
import type { CalendarEvent } from '@/lib/caldav'
import { colorMark } from '@/lib/calendar-color'
import { extrasOf } from '@/lib/event-extras'
import { formatTimeRange } from '@/lib/format'
import { blockContent, stickyHeight, type Block } from '@/lib/timeline'
import { useViewOptions } from '@/lib/view-options'

type TimelineBlockProps = {
  block: Block
  left: number
  width: number
  onOpen: (event: CalendarEvent) => void
}

export default function TimelineBlock({ block, left, width, onOpen }: TimelineBlockProps) {
  const { i18n } = useLingui()
  const view = useViewOptions()
  const { event, top, height, real } = block
  const room = Math.min(height - 2, stickyHeight)
  const { shown, titleLines } = blockContent(event, view, room)
  const { tags, place, description } = extrasOf(event, view)
  const text = {
    time: formatTimeRange(event.startTime, event.endTime, i18n.locale),
    place,
    tags: tags.join(', '),
    description,
  }
  return (
    <div data-slot="timeline-block" className="absolute p-px" style={{ top, height, left, width }}>
      <Button
        variant="ghost"
        {...colorMark}
        className="relative h-full w-full min-w-0 flex-col items-start justify-start gap-0 overflow-clip rounded-l-none rounded-r-md border-r-4 bg-muted/50 p-0 text-left font-normal whitespace-normal hover:bg-muted/70"
        style={{ borderRightColor: event.color }}
        onClick={() => {
          onOpen(event)
        }}
      >
        <span
          aria-hidden="true"
          data-slot="timeline-duration"
          className="absolute top-0 left-0 w-1 bg-foreground/35"
          style={{ height: Math.max(real, 2) }}
        />
        <span
          data-slot="timeline-content"
          className="sticky top-0 flex w-full flex-col overflow-hidden py-1.5 pr-2 pl-3"
          style={{ height: room }}
        >
          <span
            className="w-full text-[13px] leading-4 font-bold wrap-anywhere"
            style={{
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: titleLines,
              overflow: 'hidden',
            }}
          >
            {event.title}
          </span>
          {shown.map((line) => (
            <span
              key={line}
              className="w-full truncate text-xs leading-4 font-normal text-foreground/70 tabular-nums"
            >
              {text[line]}
            </span>
          ))}
        </span>
      </Button>
    </div>
  )
}
