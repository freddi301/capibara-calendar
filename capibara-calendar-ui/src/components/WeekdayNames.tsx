import { useLingui } from '@lingui/react/macro'
import { formatWeekday } from '@/lib/format'
import { weekDays } from '@/lib/week'

export default function WeekdayNames({
  selected,
  weekStart,
}: {
  selected: Temporal.PlainDate
  weekStart: number
}) {
  const { i18n } = useLingui()
  return (
    <div aria-hidden="true" className="grid grid-cols-7 text-center text-xs text-muted-foreground">
      {weekDays(selected, weekStart).map((day) => (
        <span key={day.toString()}>{formatWeekday(day, i18n.locale)}</span>
      ))}
    </div>
  )
}
