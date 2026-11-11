import { useLingui } from '@lingui/react/macro'
import DayButton from '@/components/DayButton'
import type { DayPickerProps } from '@/components/DayList'
import { formatWeekday } from '@/lib/format'
import { activeWeekStart } from '@/lib/settings'
import { monthWeeks } from '@/lib/week'

export default function MonthTable({ selected, today, countOn, onSelect }: DayPickerProps) {
  const { t, i18n } = useLingui()
  const weeks = monthWeeks(selected, activeWeekStart())
  return (
    <div role="group" aria-label={t`Month`} className="border-b px-2 pt-3 pb-1.5">
      <div
        aria-hidden="true"
        className="grid grid-cols-7 text-center text-xs text-muted-foreground"
      >
        {weeks[0].map((day) => (
          <span key={day.toString()}>{formatWeekday(day, i18n.locale)}</span>
        ))}
      </div>
      {weeks.map((week) => (
        <div key={week[0].toString()} className="grid grid-cols-7">
          {week.map((day) => (
            <DayButton
              key={day.toString()}
              isCompact
              day={day}
              count={countOn(day)}
              isSelected={day.equals(selected)}
              isToday={day.equals(today)}
              isOutside={day.month !== selected.month}
              onSelect={onSelect}
            />
          ))}
        </div>
      ))}
    </div>
  )
}
