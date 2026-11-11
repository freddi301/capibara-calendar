import { plural } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import DayNumber from '@/components/DayNumber'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatFullDate, formatWeekday } from '@/lib/format'

type DayButtonProps = {
  day: Temporal.PlainDate
  count: number
  isSelected: boolean
  isToday: boolean
  onSelect: (day: Temporal.PlainDate) => void
  isCompact?: boolean
  isOutside?: boolean
}

export default function DayButton({
  day,
  count,
  isSelected,
  isToday,
  onSelect,
  isCompact = false,
  isOutside = false,
}: DayButtonProps) {
  const { t, i18n } = useLingui()
  const date = formatFullDate(day, i18n.locale)
  const label = count ? t`${date}: ${plural(count, { one: '# event', other: '# events' })}` : date
  const badge = (
    <Badge aria-hidden="true" className="h-4 min-w-5 px-1 text-[10px] font-bold">
      {count > 99 ? '99+' : count}
    </Badge>
  )

  return (
    <Button
      variant="ghost"
      className={cn('h-auto flex-col gap-0.5 px-0', isCompact ? 'h-10' : 'min-h-19 pt-1')}
      aria-pressed={isSelected}
      aria-current={isToday ? 'date' : undefined}
      onClick={() => {
        onSelect(day)
      }}
    >
      <span className="sr-only">{label}</span>
      {!isCompact && (
        <span aria-hidden="true" className="text-xs font-normal text-muted-foreground">
          {formatWeekday(day, i18n.locale)}
        </span>
      )}
      <span aria-hidden="true" className="relative">
        <DayNumber
          day={day}
          isSelected={isSelected}
          isToday={isToday}
          isCompact={isCompact}
          isOutside={isOutside}
        />
        {isCompact && count > 0 && (
          <span className="absolute -top-1.5 left-full -ml-2">{badge}</span>
        )}
      </span>
      {!isCompact && <span className={cn('mt-0.5', !count && 'invisible')}>{badge}</span>}
    </Button>
  )
}
