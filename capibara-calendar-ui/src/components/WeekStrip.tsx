import { useLingui } from '@lingui/react/macro'
import DayButton from '@/components/DayButton'
import type { DayPickerProps } from '@/components/DayList'
import { activeWeekStart } from '@/lib/settings'
import { useSwipe } from '@/lib/swipe'
import { weekDays } from '@/lib/week'

export default function WeekStrip({ selected, today, countOn, onSelect }: DayPickerProps) {
  const { t } = useLingui()
  const swipe = useSwipe((direction) => {
    onSelect(selected.add({ weeks: direction }))
  })
  return (
    <div className="border-b">
      <div
        {...swipe}
        role="group"
        aria-label={t`Week`}
        className="mx-auto grid max-w-md touch-pan-y grid-cols-7 px-2 pt-1.5 pb-2 select-none"
      >
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
    </div>
  )
}
