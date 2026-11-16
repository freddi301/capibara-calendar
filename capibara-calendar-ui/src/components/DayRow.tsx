import { useDndMonitor, useDroppable } from '@dnd-kit/core'
import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useRef, useState, type RefObject } from 'react'
import DayNumber from '@/components/DayNumber'
import DraggableEventCard, { type DragData } from '@/components/DraggableEventCard'
import EventCard from '@/components/EventCard'
import { cardLooks, transitionNameOf } from '@/lib/move-event'
import type { DisplayEvent } from '@/lib/display-event'
import { formatFullDate, formatWeekday } from '@/lib/format'
import { useScrollEdges } from '@/lib/use-scroll-edges'
import { entryKey, type DayEntry } from '@/lib/week'

function ScrollHalfCircle({
  side,
  isShown,
  label,
  onPress,
}: {
  side: 'left' | 'right'
  isShown: boolean
  label: string
  onPress: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!isShown}
      tabIndex={isShown ? 0 : -1}
      data-slot="scroll-shadow"
      data-side={side}
      className={cn(
        'absolute top-1/2 flex h-8 w-4 -translate-y-1/2 items-center bg-primary/80 text-primary-foreground transition-opacity',
        side === 'left' ? 'left-0 rounded-r-full' : 'right-0 justify-end rounded-l-full',
        isShown ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      onClick={onPress}
    >
      {side === 'left' ? (
        <ChevronLeft className="size-3.5 -translate-x-1" />
      ) : (
        <ChevronRight className="size-3.5 translate-x-1" />
      )}
    </button>
  )
}

function DropGhost({
  day,
  dragged,
  wrapper,
}: {
  day: string
  dragged?: DragData
  wrapper: RefObject<HTMLElement | null>
}) {
  const [ghost, setGhost] = useState<{ left: number; width: number }>()
  const clear = () => {
    setGhost(undefined)
  }
  useDndMonitor({
    onDragMove({ active, over }) {
      const data = dragged
      const rect = active.rect.current.translated
      const box = wrapper.current?.getBoundingClientRect()
      if (over?.id !== day || !data || data.day === day || !rect || !box) {
        clear()
        return
      }
      const left = Math.min(Math.max(rect.left - box.left, 0), Math.max(box.width - rect.width, 0))
      setGhost({ left, width: rect.width })
    },
    onDragEnd: clear,
    onDragCancel: clear,
  })
  if (!ghost) return null
  return (
    <div
      aria-hidden="true"
      inert
      className="pointer-events-none absolute inset-y-0 z-10 pt-2 pb-1"
      style={{ left: ghost.left, width: ghost.width }}
    >
      <div data-slot="drop-ghost" className={cn('size-full rounded-md', cardLooks.target)} />
    </div>
  )
}

type DayRowProps = {
  day: Temporal.PlainDate
  isToday: boolean
  isSelected: boolean
  entries: DayEntry[]
  onSelect: (day: Temporal.PlainDate) => void
  onEdit: (event: DisplayEvent) => void
  onCreate?: (day: Temporal.PlainDate) => void
  isMovable?: (event: DisplayEvent) => boolean
  dragged?: DragData
  movingKey?: string
  menuId?: string
  onMenuClose?: () => void
  initialLeft?: number
  onScrollLeft?: (left: number) => void
}

export default function DayRow({
  day,
  isToday,
  isSelected,
  entries,
  onSelect,
  onEdit,
  onCreate,
  isMovable,
  dragged,
  movingKey,
  menuId,
  onMenuClose,
  initialLeft,
  onScrollLeft,
}: DayRowProps) {
  const { t, i18n } = useLingui()
  const { ref, edges, onScroll, scrollPage } = useScrollEdges(entries.length, initialLeft)
  const { setNodeRef } = useDroppable({ id: day.toString() })
  const wrapper = useRef<HTMLDivElement>(null)
  const nameOf = ({ event }: DayEntry) =>
    movingKey === undefined ? undefined : transitionNameOf(event, day.toString())
  return (
    <div
      ref={setNodeRef}
      role="group"
      aria-label={formatFullDate(day, i18n.locale)}
      className="flex min-h-0 flex-1 items-stretch gap-1"
    >
      <button
        type="button"
        aria-label={`${formatWeekday(day, i18n.locale)} ${day.day}, ${formatFullDate(day, i18n.locale)}`}
        aria-pressed={isSelected}
        className="flex w-12 shrink-0 flex-col items-center justify-center border-r outline-none focus-visible:bg-muted"
        onClick={() => {
          onSelect(day)
        }}
      >
        <span aria-hidden="true" className="text-sm text-muted-foreground">
          {formatWeekday(day, i18n.locale)}
        </span>{' '}
        <DayNumber day={day} isSelected={isSelected} isToday={isToday} isCompact />
      </button>
      <div ref={wrapper} className="relative -ml-1 min-w-0 flex-1">
        {isMovable && <DropGhost day={day.toString()} dragged={dragged} wrapper={wrapper} />}
        <div
          ref={ref}
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) onCreate?.(day)
          }}
          onScroll={(event) => {
            onScroll(event)
            onScrollLeft?.(event.currentTarget.scrollLeft)
          }}
          className="flex h-full snap-x snap-mandatory scroll-px-1 [scrollbar-width:none] items-stretch gap-1.5 overflow-x-auto px-1 pt-2 pb-1 [&::-webkit-scrollbar]:hidden"
        >
          {entries.map((entry) =>
            isMovable?.(entry.event) ? (
              <DraggableEventCard
                key={entryKey(entry)}
                entry={entry}
                day={day.toString()}
                isMoving={movingKey === entry.event.key}
                transitionName={nameOf(entry)}
                isMenuOpen={menuId === `${entryKey(entry)} ${day.toString()}`}
                onMenuClose={onMenuClose}
                onEdit={onEdit}
              />
            ) : (
              <EventCard
                key={entryKey(entry)}
                entry={entry}
                onEdit={onEdit}
                transitionName={nameOf(entry)}
              />
            ),
          )}
        </div>
        <ScrollHalfCircle
          side="left"
          isShown={edges.left}
          label={t`Scroll left`}
          onPress={() => {
            scrollPage(-1)
          }}
        />
        <ScrollHalfCircle
          side="right"
          isShown={edges.right}
          label={t`Scroll right`}
          onPress={() => {
            scrollPage(1)
          }}
        />
      </div>
    </div>
  )
}
