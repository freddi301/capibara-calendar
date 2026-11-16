import { useDraggable } from '@dnd-kit/core'
import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import EventCard from '@/components/EventCard'
import { cardLooks } from '@/lib/move-event'
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
  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: `${entryKey(entry)} ${day}`,
    data: { entry, day } satisfies DragData,
    attributes: { roleDescription: t`event that can be moved to another day` },
  })
  return (
    <EventCard
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-pager-ignore=""
      data-dragging={isDragging || undefined}
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
