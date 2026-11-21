import { useDroppable } from '@dnd-kit/core'
import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import DayEvents, { type EventDrag } from '@/components/DayEvents'
import type { DragData } from '@/components/DraggableEventCard'
import { Button } from '@/components/ui/button'
import type { DisplayEvent } from '@/lib/display-event'
import { formatFullDate } from '@/lib/format'
import type { DayEntry } from '@/lib/week'

type MonthCellProps = {
  day: Temporal.PlainDate
  isToday: boolean
  entries: DayEntry[]
  onEdit: (event: DisplayEvent) => void
  onCreate: (day: Temporal.PlainDate) => void
  drag: EventDrag
}

export default function MonthCell({
  day,
  isToday,
  entries,
  onEdit,
  onCreate,
  drag,
}: MonthCellProps) {
  const { t, i18n } = useLingui()
  const { setNodeRef, isOver, active } = useDroppable({ id: day.toString() })
  const date = formatFullDate(day, i18n.locale)
  const from = (active?.data.current as Partial<DragData> | undefined)?.day
  return (
    <div ref={setNodeRef} role="gridcell" className="relative border-l first:border-l-0">
      <Button
        variant="ghost"
        className="absolute inset-0 size-full rounded-none hover:bg-muted/40"
        aria-label={t`New event: ${date}`}
        onClick={() => {
          onCreate(day)
        }}
      />
      {entries.length > 0 && (
        <DayEvents day={day.toString()} entries={entries} onEdit={onEdit} drag={drag} />
      )}
      <span
        aria-hidden="true"
        className={cn(
          'pointer-events-none absolute top-0 left-0 z-10 flex h-5 min-w-5.5 items-center justify-center rounded-br-md bg-background px-0.5 text-sm leading-none',
          isToday && 'bg-primary font-bold text-primary-foreground',
        )}
      >
        {day.day}
      </span>
      {isOver && from !== day.toString() && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-30 bg-primary/10 ring-2 ring-primary ring-inset"
        />
      )}
    </div>
  )
}
