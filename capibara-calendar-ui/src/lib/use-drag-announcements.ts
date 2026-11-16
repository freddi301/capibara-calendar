import type { Active, Announcements, DndContextProps } from '@dnd-kit/core'
import { useLingui } from '@lingui/react/macro'
import type { DragData } from '@/components/DraggableEventCard'
import { formatFullDate } from './format'

export function useDragAnnouncements(
  dragged?: DragData,
): NonNullable<DndContextProps['accessibility']> {
  const { t, i18n } = useLingui()
  const titleOf = (active: Active) =>
    dragged?.entry.event.title ??
    (active.data.current as Partial<DragData> | undefined)?.entry?.event.title ??
    ''
  const dayOf = (id: string | number) =>
    formatFullDate(Temporal.PlainDate.from(String(id)), i18n.locale)
  const announcements: Announcements = {
    onDragStart: ({ active }) => {
      const title = titleOf(active)
      return t`${title} picked up`
    },
    onDragMove: () => undefined,
    onDragOver: ({ active, over }) => {
      if (!over) return undefined
      const title = titleOf(active)
      const day = dayOf(over.id)
      return t`${title} is over ${day}`
    },
    onDragEnd: () => undefined,
    onDragCancel: ({ active }) => {
      const title = titleOf(active)
      return t`Moving ${title} was cancelled`
    },
  }
  return {
    announcements,
    screenReaderInstructions: {
      draggable: t`To move this event to another day, press Space to pick it up, the up and down arrow keys to choose the day, and Space to drop it. Escape cancels.`,
    },
    restoreFocus: true,
  }
}
