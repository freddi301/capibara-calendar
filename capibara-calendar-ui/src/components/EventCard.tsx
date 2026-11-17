import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import type { ComponentProps } from 'react'
import EventMarks from '@/components/EventMarks'
import EventMenu from '@/components/EventMenu'
import TagBadges from '@/components/TagBadges'
import { Button } from '@/components/ui/button'
import type { DisplayEvent } from '@/lib/display-event'
import { colorBorder, colorMark, eventBorder } from '@/lib/calendar-color'
import { extrasOf } from '@/lib/event-extras'
import { titleStyle } from '@/lib/event-marks'
import { formatTimeRange } from '@/lib/format'
import { dayFill, type DayEntry } from '@/lib/week'
import { useStored } from '@/lib/use-stored'

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
  const { i18n } = useLingui()
  const time = formatTimeRange(start, end, i18n.locale)
  const { tags, place, description } = extrasOf(
    event,
    useStored((stored) => stored.viewOptions),
  )
  const rest = [place, description].filter(Boolean).join(' · ')
  const extras = tags.length > 0 || rest
  return (
    <EventMenu event={event.source} isOpen={menu?.isOpen} onClose={menu?.onClose}>
      <Button
        variant="ghost"
        {...colorMark}
        {...props}
        className={cn(
          'relative h-auto min-w-0 shrink-0 basis-[calc((100%-(var(--cards,2)-1)*0.375rem)/var(--cards,2))] snap-start flex-col items-start justify-start gap-0.5 rounded-l-none rounded-r-md border-l-0 bg-muted/50 pt-2 pr-2 pb-1.5 pl-3 text-left font-normal whitespace-normal hover:bg-muted/70',
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
        <EventMarks event={event} />
        {time && (
          <span className="max-w-full truncate text-sm leading-tight font-semibold text-foreground/70 tabular-nums">
            {time}
          </span>
        )}
        <span
          className={cn(
            'text-base leading-tight font-bold wrap-anywhere hyphenated',
            extras ? 'line-clamp-2' : 'line-clamp-3',
            titleStyle(event),
          )}
        >
          {event.title}
        </span>
        {extras && (
          <span className="flex w-full min-w-0 items-center gap-1 text-sm leading-tight font-normal text-foreground/70">
            {tags.length > 0 && <TagBadges tags={tags} />}
            {rest && <span className="min-w-0 flex-1 truncate">{rest}</span>}
          </span>
        )}
      </Button>
    </EventMenu>
  )
}
