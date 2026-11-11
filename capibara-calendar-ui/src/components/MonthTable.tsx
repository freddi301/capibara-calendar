import { useLingui } from '@lingui/react/macro'
import DayButton from '@/components/DayButton'
import type { DayPickerProps } from '@/components/DayList'
import SnapPager from '@/components/SnapPager'
import WeekdayNames from '@/components/WeekdayNames'
import { activeWeekStart } from '@/lib/settings'
import { monthPages, monthTableWeeks, monthWeeks } from '@/lib/week'

export default function MonthTable({ selected, today, countOn, onSelect }: DayPickerProps) {
  const { t } = useLingui()
  const weekStart = activeWeekStart()
  const [before, current, after] = monthPages(selected, weekStart).map(({ day: anchor }) => (
    <div
      key={anchor.toString()}
      role="group"
      aria-label={t`Month`}
      className="flex h-full flex-col pt-1.5 pb-2"
    >
      {monthWeeks(anchor, weekStart, monthTableWeeks).map((week) => (
        <div key={week[0].toString()} className="grid grid-cols-7">
          {week.map((day) => (
            <DayButton
              key={day.toString()}
              isCompact
              day={day}
              count={countOn(day)}
              isSelected={day.equals(selected)}
              isToday={day.equals(today)}
              isOutside={day.month !== anchor.month}
              onSelect={onSelect}
            />
          ))}
        </div>
      ))}
    </div>
  ))

  return (
    <div className="border-b">
      <div className="mx-auto max-w-md px-2 pt-4">
        <WeekdayNames selected={selected} weekStart={weekStart} />
      </div>
      <div className="has-[[data-scrolling]]:shadow-[inset_0_1px_0_0_var(--border)]">
        <div className="mx-auto max-w-md px-2">
          <SnapPager
            axis="y"
            centerKey={selected.toString()}
            className="h-57.5"
            onPage={(direction) => {
              onSelect(selected.add({ months: direction }))
            }}
            pages={[before, current, after]}
          />
        </div>
      </div>
    </div>
  )
}
