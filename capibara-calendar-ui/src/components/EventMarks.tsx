import { Bell, MapPin, Repeat, Video } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from 'cn'
import type { CalendarEvent } from '@/lib/caldav'
import { hasMarks } from '@/lib/event-marks'

function Mark({ children, isHalf }: { children: ReactNode; isHalf: boolean }) {
  return (
    <span className="relative flex size-5.5">
      {isHalf && (
        <span
          aria-hidden="true"
          className="absolute -inset-px rounded-full bg-background [clip-path:inset(0_0_50%_0)]"
        />
      )}
      <span
        className={cn(
          'relative flex size-full items-center justify-center rounded-full',
          isHalf
            ? 'bg-[linear-gradient(to_bottom,color-mix(in_oklab,var(--muted)_70%,var(--background))_calc(50%_+_1px),transparent_calc(50%_+_1px))]'
            : 'bg-[color-mix(in_oklab,var(--muted)_50%,var(--background))]',
        )}
      >
        {children}
      </span>
    </span>
  )
}

export default function EventMarks({
  event,
  className,
  isHalf = false,
}: {
  event: CalendarEvent
  className?: string
  isHalf?: boolean
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
        <Mark isHalf={isHalf}>
          <Repeat className="text-orange-600 dark:text-orange-400" />
        </Mark>
      )}
      {event.location && (
        <Mark isHalf={isHalf}>
          <MapPin className="text-red-600 dark:text-red-400" />
        </Mark>
      )}
      {event.videoLink && (
        <Mark isHalf={isHalf}>
          <Video className="text-violet-600 dark:text-violet-400" />
        </Mark>
      )}
      {event.reminder && (
        <Mark isHalf={isHalf}>
          <Bell className="text-blue-600 dark:text-blue-400" />
        </Mark>
      )}
    </span>
  )
}
