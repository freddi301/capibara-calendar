import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import EventMarks from '@/components/EventMarks'
import EventMenu from '@/components/EventMenu'
import TagBadges from '@/components/TagBadges'
import { Button } from '@/components/ui/button'
import type { DisplayEvent } from '@/lib/display-event'
import { colorMark, eventBorder } from '@/lib/calendar-color'
import { extrasOf } from '@/lib/event-extras'
import { titleStyle } from '@/lib/event-marks'
import { formatTime } from '@/lib/format'
import { stickyHeight, textLineHeight, textLines, type Block } from '@/lib/timeline'
import { useViewOptions } from '@/lib/view-options'

type TimelineBlockProps = {
  block: Block
  left: number
  width: number
  onOpen: (event: DisplayEvent) => void
}

export default function TimelineBlock({ block, left, width, onOpen }: TimelineBlockProps) {
  const { i18n } = useLingui()
  const view = useViewOptions()
  const { event, top, height, real } = block
  const room = Math.min(height - 2, stickyHeight)
  const { tags, place, description } = extrasOf(event, view)
  const titleLines = Math.max(1, Math.min(2, textLines(room) - (tags.length > 0 ? 1 : 0)))
  return (
    <div data-slot="timeline-block" className="absolute p-px" style={{ top, height, left, width }}>
      <EventMenu event={event.source}>
        <Button
          variant="ghost"
          {...colorMark}
          className={cn(
            'relative h-full w-full min-w-0 flex-col items-start justify-start gap-0 overflow-clip rounded-l-none rounded-r-md border-r-4 bg-muted/70 p-0 text-left font-normal whitespace-normal hover:bg-muted/85',
            event.eventColor && 'border-b-4',
          )}
          style={{ borderRightColor: event.color, ...eventBorder(event.eventColor) }}
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
              className="-mx-1 block overflow-hidden px-1"
              style={{ maxHeight: textLines(room) * textLineHeight }}
            >
              {event.startTime && (
                <span className="float-right ml-2 flex flex-col items-end text-right leading-5 tabular-nums">
                  <span className="text-sm font-bold">
                    {formatTime(event.startTime, i18n.locale)}
                  </span>
                  {event.endTime && (
                    <span className="text-sm font-normal text-foreground/60">
                      {formatTime(event.endTime, i18n.locale)}
                    </span>
                  )}
                </span>
              )}
              <span
                className={cn(
                  'line-clamp-2 text-sm leading-5 font-bold wrap-anywhere',
                  titleStyle(event),
                )}
                style={{ WebkitLineClamp: titleLines }}
              >
                {event.title}
              </span>
              {tags.length > 0 && (
                <TagBadges
                  tags={tags}
                  className="text-sm leading-5 font-normal text-foreground/70"
                />
              )}
              {place && (
                <span className="block truncate text-sm leading-5 font-normal text-foreground/70">
                  {place}
                </span>
              )}
              {description && (
                <span className="block max-h-15 overflow-clip text-sm leading-5 font-normal wrap-anywhere text-foreground/70">
                  {description}
                </span>
              )}
            </span>
          </span>
        </Button>
      </EventMenu>
      <EventMarks event={event} className="-top-2.5 right-2" isHalf />
    </div>
  )
}
