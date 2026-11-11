import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import type { CalendarEvent } from '@/lib/caldav'
import { formatTime, usesTwelveHours } from '@/lib/format'
import type { DayEntry } from '@/lib/week'

type EventItemProps = {
  entry: DayEntry
  onEdit: (event: CalendarEvent) => void
}

export default function EventItem({ entry: { event, start, end }, onEdit }: EventItemProps) {
  const { i18n } = useLingui()
  return (
    <Button
      variant="ghost"
      className="h-auto w-full shrink-0 items-start justify-start gap-3 rounded-md bg-muted/50 px-3 py-2.5 text-left font-normal whitespace-normal hover:bg-muted/70"
      onClick={() => {
        onEdit(event)
      }}
    >
      <span
        className={cn(
          'flex shrink-0 flex-col text-[13px] leading-snug tabular-nums',
          usesTwelveHours(i18n.locale) ? 'w-[4.5rem]' : 'w-12',
        )}
      >
        {start && <span className="font-semibold">{formatTime(start, i18n.locale)}</span>}
        {end && <span className="text-foreground/70">{formatTime(end, i18n.locale)}</span>}
      </span>
      <span className="min-w-0 text-base font-bold break-words">{event.title}</span>
    </Button>
  )
}
