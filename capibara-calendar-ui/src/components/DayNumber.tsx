import { cn } from 'cn'

type DayNumberProps = {
  day: Temporal.PlainDate
  isSelected: boolean
  isToday: boolean
  isCompact?: boolean
  isOutside?: boolean
}

export default function DayNumber({
  day,
  isSelected,
  isToday,
  isCompact = false,
  isOutside = false,
}: DayNumberProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex items-center justify-center rounded-full border-[1.5px] border-transparent text-base',
        isCompact ? 'size-8' : 'size-9',
        isOutside && !isSelected && 'text-muted-foreground',
        isToday && 'border-primary font-bold',
        isSelected && 'bg-primary font-bold text-primary-foreground',
      )}
    >
      {day.day}
    </span>
  )
}
