import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { cn } from 'cn'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { calendarKey } from '@/api/calendar-api'
import DateLine from '@/components/DateLine'
import DayRow from '@/components/DayRow'
import type { DragData } from '@/components/DraggableEventCard'
import EdgePaging from '@/components/EdgePaging'
import EventCard from '@/components/EventCard'
import ListBottomBar, {
  ListActions,
  ListEndActions,
  ListStartActions,
} from '@/components/ListBottomBar'
import ListStatus from '@/components/ListStatus'
import SnapPager from '@/components/SnapPager'
import type { DisplayEvent } from '@/lib/display-event'
import { collideByPointerOrCenter, keyboardCodes, moveByDay } from '@/lib/drag-targets'
import type { ListScreenProps } from '@/lib/layout'
import { canMoveEvent, cardLooks, daysBetween, liftedProps } from '@/lib/move-event'
import { pageTowards } from '@/lib/pager-style'
import { activeTimeZone, activeWeekStart } from '@/lib/settings'
import { useCalendars } from '@/lib/use-calendars'
import { useDragAnnouncements } from '@/lib/use-drag-announcements'
import { useMoveEvent } from '@/lib/use-move-event'
import { useEventPages } from '@/lib/use-events'
import { useCardsAcross } from '@/lib/cards-across'
import { keepScroll, keptScroll, weekRowsScroll } from '@/lib/kept-scroll'
import { useReportDate } from '@/lib/use-report-date'
import { withViewTransition } from '@/lib/view-transition'
import { entryKey, eventsOn, isFarPage, weekDays, weekPages } from '@/lib/week'

const noop = () => undefined

export default function WeekRowsScreen({
  date,
  onCreate,
  onEdit,
  onOpenSettings,
  onOpenLayouts,
  onOpenView,
  onOpenCalendars,
  onOpenFilters,
  onDateChange,
}: ListScreenProps) {
  const today = Temporal.Now.plainDateISO(activeTimeZone())
  const [selected, setSelected] = useState(date ? Temporal.PlainDate.from(date) : today)
  useReportDate(selected, onDateChange)
  // How far each row was scrolled sideways, for when the screen is made again.
  const [kept] = useState(() => keptScroll(weekRowsScroll, date))
  const lefts = useRef({ ...kept?.lefts })
  useEffect(() => {
    keepScroll(weekRowsScroll, { date: selected.toString(), lefts: lefts.current })
  }, [selected])
  const weekStart = activeWeekStart()
  const { ref, cards } = useCardsAcross()
  const pages = weekPages(selected, weekStart)
  const events = useEventPages(pages.map(({ range }) => range))
  const calendars = useCalendars()
  const { move, movingKey } = useMoveEvent()
  const [lifted, setLifted] = useState<DragData>()
  // The card that was lifted and let go where it was: its menu is open.
  const [menuId, setMenuId] = useState<string>()
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 400, tolerance: 8 } }),
    useSensor(KeyboardSensor, { keyboardCodes, coordinateGetter: moveByDay }),
  )
  const accessibility = useDragAnnouncements(lifted)
  const isMovable = (event: DisplayEvent) =>
    canMoveEvent(
      event,
      calendars.data?.find(({ ref }) => calendarKey(ref) === event.calendarKey)?.rights,
    )
  const [before, current, after] = pages.map(({ day: anchor }) => (
    <div key={anchor.toString()} className="flex h-full flex-col">
      {weekDays(anchor, weekStart).map((day) => (
        <DayRow
          key={day.toString()}
          day={day}
          isToday={day.equals(today)}
          isSelected={day.equals(selected)}
          onSelect={setSelected}
          entries={eventsOn(events.data, day)}
          onEdit={onEdit}
          onCreate={(date) => {
            onCreate(date.toString())
          }}
          isMovable={isMovable}
          dragged={lifted}
          movingKey={movingKey}
          menuId={menuId}
          onMenuClose={() => {
            setMenuId(undefined)
          }}
          initialLeft={kept?.lefts?.[day.toString()]}
          onScrollLeft={(left) => {
            lefts.current[day.toString()] = left
            keepScroll(weekRowsScroll, { date: selected.toString(), lefts: lefts.current })
          }}
        />
      ))}
    </div>
  ))

  const bar = {
    onOpenSettings,
    onOpenLayouts: () => {
      onOpenLayouts(selected.toString())
    },
    onOpenView: () => {
      onOpenView(selected.toString())
    },
    onOpenCalendars,
    onOpenFilters,
    onCreate: () => {
      onCreate(selected.toString())
    },
  }

  return (
    <>
      <main className="mx-auto flex h-dvh flex-col">
        <ListStatus isConnected={events.isSuccess} />
        <DateLine
          leading={<ListStartActions {...bar} />}
          actions={<ListEndActions {...bar} />}
          selected={selected}
          today={today}
          onSelect={(day) => {
            if (isFarPage(weekPages, selected, day, weekStart)) {
              withViewTransition(() => {
                setSelected(day)
              })
            } else setSelected(day)
          }}
        />

        <div
          ref={ref}
          style={{ '--cards': cards } as CSSProperties}
          className="flex min-h-0 flex-1 flex-col border-t pb-0 phone:pb-12"
        >
          <DndContext
            sensors={sensors}
            collisionDetection={collideByPointerOrCenter}
            autoScroll={false}
            accessibility={accessibility}
            onDragStart={({ active }) => {
              setLifted(active.data.current as DragData | undefined)
            }}
            onDragCancel={() => {
              setLifted(undefined)
            }}
            onDragEnd={({ over, delta }) => {
              const data = lifted
              setLifted(undefined)
              if (data && Math.hypot(delta.x, delta.y) < 4) {
                setMenuId(`${entryKey(data.entry)} ${data.day}`)
                return
              }
              if (!data || !over || over.id === data.day) return
              move({ event: data.entry.event, days: daysBetween(data.day, String(over.id)) })
            }}
          >
            <SnapPager
              axis="y"
              centerKey={selected.toString()}
              className="min-h-0 flex-1"
              onPage={(direction) => {
                setSelected(selected.add({ weeks: direction }))
              }}
              pages={[before, current, after]}
            />
            <EdgePaging weekKey={selected.toString()} onPage={pageTowards} />
            <DragOverlay dropAnimation={null}>
              {lifted && (
                <EventCard
                  entry={lifted.entry}
                  onEdit={noop}
                  look={cardLooks.lifted}
                  {...liftedProps}
                  className={cn('h-full w-full')}
                />
              )}
            </DragOverlay>
          </DndContext>
        </div>
      </main>

      <ListBottomBar>
        <ListActions {...bar} />
      </ListBottomBar>
    </>
  )
}
