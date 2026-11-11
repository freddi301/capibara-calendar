import { useLingui } from '@lingui/react/macro'
import DayButton from '@/components/DayButton'
import type { DayPickerProps } from '@/components/DayList'
import { activeWeekStart } from '@/lib/settings'
import { weekDays } from '@/lib/week'

export default function WeekStrip({ selected, today, countOn, onSelect }: DayPickerProps) {
  const { t } = useLingui()
  return (
    <div role="group" aria-label={t`Week`} className="grid grid-cols-7 border-b px-2 pt-1.5 pb-2">
      {weekDays(selected, activeWeekStart()).map((day) => (
        <DayButton
          key={day.toString()}
          day={day}
          count={countOn(day)}
          isSelected={day.equals(selected)}
          isToday={day.equals(today)}
          onSelect={onSelect}
        />
      ))}
    </div>
  )
}
