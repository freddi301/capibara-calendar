import { useLingui } from '@lingui/react/macro'
import EventMarks from '@/components/EventMarks'
import { Button } from '@/components/ui/button'
import type { CalendarEvent } from '@/lib/caldav'
import { colorMark } from '@/lib/calendar-color'
import { extrasOf } from '@/lib/event-extras'
import { formatTime } from '@/lib/format'
import { stickyHeight, textLineHeight, textLines, type Block } from '@/lib/timeline'
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
  const { tags, place, description } = extrasOf(event, view)
  const tagsText = tags.join(', ')
  return (
    <div data-slot="timeline-block" className="absolute p-px" style={{ top, height, left, width }}>
      <Button
        variant="ghost"
        {...colorMark}
        className="relative h-full w-full min-w-0 flex-col items-start justify-start gap-0 overflow-clip rounded-none border-r-4 bg-muted/70 p-0 text-left font-normal whitespace-normal hover:bg-muted/85"
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
          className="sticky top-0 block w-full overflow-hidden py-1 pr-2 pl-3"
          style={{ height: room }}
        >
          <span
            className="block overflow-hidden"
            style={{ maxHeight: textLines(room) * textLineHeight }}
          >
            {event.startTime && (
              <span className="float-right ml-2 flex flex-col items-end text-right leading-4 tabular-nums">
                <span className="text-[13px] font-bold">
                  {formatTime(event.startTime, i18n.locale)}
                </span>
                {event.endTime && (
                  <span className="text-xs font-normal text-foreground/60">
                    {formatTime(event.endTime, i18n.locale)}
                  </span>
                )}
              </span>
            )}
            <span className="line-clamp-2 text-[13px] leading-4 font-bold wrap-anywhere">
              {event.title}
            </span>
            {tagsText && (
              <span className="block truncate text-xs leading-4 font-normal text-foreground/70">
                {tagsText}
              </span>
            )}
            {place && (
              <span className="block truncate text-xs leading-4 font-normal text-foreground/70">
                {place}
              </span>
            )}
            {description && (
              <span className="block max-h-12 overflow-clip text-xs leading-4 font-normal wrap-anywhere text-foreground/70">
                {description}
              </span>
            )}
          </span>
        </span>
      </Button>
      <EventMarks event={event} className="-top-2.5 right-2" isHalf />
    </div>
  )
}
