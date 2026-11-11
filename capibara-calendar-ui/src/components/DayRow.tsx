import { useLingui } from '@lingui/react/macro'
import DayNumber from '@/components/DayNumber'
import EventCard from '@/components/EventCard'
import type { CalendarEvent } from '@/lib/caldav'
import { formatFullDate, formatWeekday } from '@/lib/format'
import type { DayEntry } from '@/lib/week'

type DayRowProps = {
  day: Temporal.PlainDate
  isToday: boolean
  entries: DayEntry[]
  onEdit: (event: CalendarEvent) => void
}

export default function DayRow({ day, isToday, entries, onEdit }: DayRowProps) {
  const { i18n } = useLingui()
  return (
    <div
      role="group"
      aria-label={formatFullDate(day, i18n.locale)}
      className="flex min-h-0 flex-1 items-stretch gap-1 border-b py-1 pr-2 last:border-b-0"
    >
      <div aria-hidden="true" className="flex w-12 shrink-0 flex-col items-center justify-center">
        <span className="text-xs text-muted-foreground">{formatWeekday(day, i18n.locale)}</span>
        <DayNumber day={day} isSelected={isToday} isToday={isToday} isCompact />
      </div>
      <div className="grid min-w-0 flex-1 [scrollbar-width:none] auto-cols-[calc((100%-0.75rem)/3)] grid-flow-col grid-rows-2 gap-x-1.5 gap-y-1 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {entries.map((entry, index) => (
          <EventCard
            key={entry.event.url}
            entry={entry}
            isTall={index === entries.length - 1 && index % 2 === 0}
            onEdit={onEdit}
          />
        ))}
      </div>
    </div>
  )
}
