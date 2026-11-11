import { Bell, MapPin, Repeat, Video } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from 'cn'
import type { CalendarEvent } from '@/lib/caldav'
import { hasMarks } from '@/lib/event-marks'

function Mark({ children }: { children: ReactNode }) {
  return (
    <span className="flex size-5.5 items-center justify-center rounded-full bg-[color-mix(in_oklab,var(--muted)_50%,var(--background))]">
      {children}
    </span>
  )
}

export default function EventMarks({
  event,
  className,
}: {
  event: CalendarEvent
  className?: string
}) {
  if (!hasMarks(event)) return null
  return (
    <span
      aria-hidden="true"
      data-slot="event-marks"
      className={cn(
        'pointer-events-none absolute -top-2 right-0.5 flex items-center gap-1 [&_svg]:size-3',
        className,
      )}
    >
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
      {event.reminder && (
        <Mark>
          <Bell className="text-blue-600 dark:text-blue-400" />
        </Mark>
      )}
    </span>
  )
}
