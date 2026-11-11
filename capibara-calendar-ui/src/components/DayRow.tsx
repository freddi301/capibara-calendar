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
      {/* Two cards across, of the height of the row. The others are found by scrolling sideways. */}
      <div className="flex min-w-0 flex-1 [scrollbar-width:none] items-stretch gap-1.5 overflow-x-auto [&::-webkit-scrollbar]:hidden">
        {entries.map((entry) => (
          <EventCard key={entry.event.url} entry={entry} onEdit={onEdit} />
        ))}
      </div>
    </div>
  )
}
