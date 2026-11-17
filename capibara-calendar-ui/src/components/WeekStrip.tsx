import { useLingui } from '@lingui/react/macro'
import DayButton from '@/components/DayButton'
import type { DayPickerProps } from '@/components/DayPickerBar'
import SnapPager from '@/components/SnapPager'
import WeekdayNames from '@/components/WeekdayNames'
import { activeWeekStart } from '@/lib/settings'
import { weekDays, weekPages } from '@/lib/week'

export default function WeekStrip({
  selected,
  anchor,
  today,
  countOn,
  onSelect,
  onPage,
}: DayPickerProps) {
  const { t } = useLingui()
  const weekStart = activeWeekStart()
  const [before, current, after] = weekPages(anchor, weekStart).map(({ day: anchor }) => (
    <div
      key={anchor.toString()}
      role="group"
      aria-label={t`Week`}
      className="grid grid-cols-7 pt-1.5 pb-2"
    >
      {weekDays(anchor, weekStart).map((day) => (
        <DayButton
          key={day.toString()}
          isCompact
          day={day}
          count={countOn(day)}
          isSelected={day.equals(selected)}
          isToday={day.equals(today)}
          onSelect={onSelect}
        />
      ))}
    </div>
  ))

  return (
    <div className="border-b">
      <div className="mx-auto max-w-md px-2 pt-3">
        <WeekdayNames selected={anchor} weekStart={weekStart} />
      </div>
      <div className="mx-auto max-w-md px-2">
        <SnapPager
          axis="x"
          centerKey={anchor.toString()}
          onPage={onPage}
          pages={[before, current, after]}
        />
      </div>
    </div>
  )
}
