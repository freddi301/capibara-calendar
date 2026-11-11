import { useLingui } from '@lingui/react/macro'
import DayButton from '@/components/DayButton'
import type { DayPickerProps } from '@/components/DayList'
import { formatWeekday } from '@/lib/format'
import { activeWeekStart } from '@/lib/settings'
import { useSwipe } from '@/lib/swipe'
import { monthWeeks } from '@/lib/week'

export default function MonthTable({ selected, today, countOn, onSelect }: DayPickerProps) {
  const { t, i18n } = useLingui()
  const weeks = monthWeeks(selected, activeWeekStart())
  // Swiping up goes to the month after, and down to the month before, on the same day.
  const swipe = useSwipe((direction) => {
    onSelect(selected.add({ months: direction }))
  }, 'y')
  return (
    <div className="border-b">
      <div
        {...swipe}
        role="group"
        aria-label={t`Month`}
        className="mx-auto max-w-md touch-pan-x px-2 pt-3 pb-1.5 select-none"
      >
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
    </div>
  )
}
