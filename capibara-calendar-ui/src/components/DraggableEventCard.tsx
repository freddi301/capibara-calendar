import { useDraggable } from '@dnd-kit/core'
import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import EventCard from '@/components/EventCard'
import { cardLooks } from '@/lib/move-event'
import { useCalendars } from '@/lib/use-calendars'
import type { DisplayEvent } from '@/lib/display-event'
import { entryKey, type DayEntry } from '@/lib/week'

const noop = () => undefined

export type DragData = { entry: DayEntry; day: string }

type DraggableEventCardProps = {
  entry: DayEntry
  day: string
  isMoving: boolean
  transitionName?: string
  isMenuOpen?: boolean
  onMenuClose?: () => void
  onEdit: (event: DisplayEvent) => void
}

export default function DraggableEventCard({
  entry,
  day,
  isMoving,
  transitionName,
  isMenuOpen,
  onMenuClose,
  onEdit,
}: DraggableEventCardProps) {
  const { t } = useLingui()
  const calendars = useCalendars()
  const isMovable =
    calendars.data?.find(({ url }) => url === entry.event.calendarKey)?.rights.update ?? true
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `${entryKey(entry)} ${day}`,
    data: { entry, day } satisfies DragData,
    disabled: !isMovable,
    attributes: { roleDescription: t`event that can be moved to another day` },
  })
  return (
    <EventCard
      ref={setNodeRef}
      {...(isMovable ? listeners : undefined)}
      {...(isMovable ? attributes : undefined)}
      data-pager-ignore={isMovable ? '' : undefined}
      data-dragging={isDragging || undefined}
      onContextMenu={(event) => {
        const { pointerType } = event.nativeEvent as PointerEvent
        if (pointerType === 'touch' || pointerType === 'pen') event.preventDefault()
      }}
      entry={entry}
      onEdit={onEdit}
      look={isDragging ? cardLooks.origin : undefined}
      isMoving={isMoving}
      transitionName={transitionName}
      menu={{ isOpen: !!isMenuOpen, onClose: onMenuClose ?? noop }}
      className={cn('select-none [-webkit-touch-callout:none]')}
    />
  )
}
