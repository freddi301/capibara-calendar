import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import type { ReactNode } from 'react'
import type { ParticipationStatus } from '@/api/calendar-api'
import DurationSummary from '@/components/DurationSummary'
import ParticipationBar from '@/components/ParticipationBar'
import TagBadges from '@/components/TagBadges'
import type { DisplayEvent } from '@/lib/display-event'
import { daysSpanned } from '@/lib/duration'
import { contentOf } from '@/lib/event-content'
import { titleStyle } from '@/lib/event-marks'
import { formatTimeRange } from '@/lib/format'
import { participationLabels } from '@/lib/participation-labels'
import { useCalendars } from '@/lib/use-calendars'
import { useStored } from '@/lib/use-stored'

function Line({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn('block h-6 overflow-clip text-clip whitespace-nowrap', className)}>
      {children}
    </span>
  )
}

function CalendarName({ calendarKey }: { calendarKey: string }) {
  const calendars = useCalendars()
  const name = calendars.data?.find(({ url }) => url === calendarKey)?.name
  return name ? <Line className="text-muted-foreground">{name}</Line> : null
}

type EventContentProps = {
  event: DisplayEvent
  mine?: ParticipationStatus
  start?: string
  end?: string
}

export default function EventContent({
  event,
  mine,
  start = event.startTime,
  end = event.endTime,
}: EventContentProps) {
  const { i18n } = useLingui()
  const view = useStored((stored) => stored.viewOptions)
  const { tags, place, statuses, description } = contentOf(event, view)
  const days = daysSpanned(event) ?? 1
  return (
    <span className="block w-full min-w-0 text-base leading-6 font-normal">
      {event.startTime || days > 1 ? (
        <Line className="tabular-nums">
          {event.startTime ? (
            <>
              <span className="font-semibold text-foreground/70">
                {formatTimeRange(start, end, i18n.locale)}
              </span>{' '}
              <DurationSummary range={event} part="both" />
            </>
          ) : (
            <span className="font-semibold text-foreground/70">
              <Plural value={days} one="# day" other="# days" />
            </span>
          )}
        </Line>
      ) : (
        <span className="sr-only">
          <Trans>All day</Trans>
        </span>
      )}
      <span className={cn('line-clamp-3 font-bold break-all', titleStyle(event))}>
        {event.title}
      </span>
      {mine && <span className="sr-only">{i18n._(participationLabels[mine])}</span>}
      {view.calendar && <CalendarName calendarKey={event.calendarKey} />}
      {tags.length > 0 && <TagBadges tags={tags} className="h-6 text-foreground/70" />}
      {place && <Line className="text-foreground/70">{place}</Line>}
      {statuses.length > 0 && <ParticipationBar statuses={statuses} />}
      {description && (
        <span className="line-clamp-3 break-all text-foreground/70">{description}</span>
      )}
    </span>
  )
}
