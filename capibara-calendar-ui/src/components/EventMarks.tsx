import { Ban, Bell, Check, CircleHelp, MapPin, Repeat, Users, Video } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from 'cn'
import type { ParticipationStatus } from '@/api/calendar-api'
import type { DisplayEvent } from '@/lib/display-event'
import { hasMarks } from '@/lib/event-marks'
import { participationTick } from '@/lib/participation-colors'

/** Only the top half of the circle has a background: the mark sits on the top edge of the event. */
function Mark({ children }: { children: ReactNode }) {
  return (
    <span className="relative flex size-5.5">
      <span
        aria-hidden="true"
        className="absolute -inset-px rounded-full bg-background [clip-path:inset(0_0_50%_0)]"
      />
      <span className="relative flex size-full items-center justify-center rounded-full bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--muted)_70%,var(--background))_calc(50%_+_1px),transparent_calc(50%_+_1px))]">
        {children}
      </span>
    </span>
  )
}

export default function EventMarks({
  event,
  mine,
  className,
}: {
  event: DisplayEvent
  /** What I answered to the event: its tick is the first mark. */
  mine?: ParticipationStatus
  className?: string
}) {
  if (!hasMarks(event) && !mine) return null
  return (
    <span
      aria-hidden="true"
      data-slot="event-marks"
      className={cn(
        'pointer-events-none absolute -top-2 right-0.5 flex items-center gap-1 [&_svg]:size-3',
        className,
      )}
    >
      {mine && (
        <Mark>
          <Check className={participationTick[mine]} />
        </Mark>
      )}
      {event.status === 'cancelled' && (
        <Mark>
          <Ban className="text-muted-foreground" />
        </Mark>
      )}
      {event.status === 'tentative' && (
        <Mark>
          <CircleHelp className="text-amber-600 dark:text-amber-400" />
        </Mark>
      )}
      {event.isRecurring && (
        <Mark>
          <Repeat className="text-orange-600 dark:text-orange-400" />
        </Mark>
      )}
      {event.location && (
        <Mark>
          <MapPin className="text-red-600 dark:text-red-400" />
        </Mark>
      )}
      {event.videoLink && (
        <Mark>
          <Video className="text-violet-600 dark:text-violet-400" />
        </Mark>
      )}
      {event.hasAlerts && (
        <Mark>
          <Bell className="text-blue-600 dark:text-blue-400" />
        </Mark>
      )}
      {event.hasParticipants && (
        <Mark>
          <Users className="text-teal-600 dark:text-teal-400" />
        </Mark>
      )}
    </span>
  )
}
