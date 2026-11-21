import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { Trans } from '@lingui/react/macro'
import { Monitor } from 'lucide-react'
import { useState } from 'react'
import { calendarKey } from '@/api/calendar-api'
import DateLine from '@/components/DateLine'
import type { DragData } from '@/components/DraggableEventCard'
import EdgePaging from '@/components/EdgePaging'
import EventCard from '@/components/EventCard'
import ListBottomBar, {
  ListActions,
  ListEndActions,
  ListStartActions,
} from '@/components/ListBottomBar'
import ListStatus from '@/components/ListStatus'
import MonthGrid from '@/components/MonthGrid'
import { Button } from '@/components/ui/button'
import WeekdayNames from '@/components/WeekdayNames'
import type { DisplayEvent } from '@/lib/display-event'
import { collideByPointerOrCenter, keyboardCodes, moveByDay } from '@/lib/drag-targets'
import type { ListScreenProps } from '@/lib/layout'
import { canMoveEvent, cardLooks, daysBetween, liftedProps } from '@/lib/move-event'
import { activeTimeZone, activeWeekStart } from '@/lib/settings'
import { useCalendars } from '@/lib/use-calendars'
import { useDragAnnouncements } from '@/lib/use-drag-announcements'
import { useEventPages } from '@/lib/use-events'
import { useMoveEvent } from '@/lib/use-move-event'
import { useReportDate } from '@/lib/use-report-date'
import { useRoomyScreen } from '@/lib/use-roomy-screen'
import { entryKey, monthPages } from '@/lib/week'

const noop = () => undefined

export default function MonthScreen({
  date,
  onCreate,
  onEdit,
  onOpenSettings,
  onOpenLayouts,
  onChooseLayout,
  onOpenView,
  onOpenCalendars,
  onOpenFilters,
  onDateChange,
}: ListScreenProps) {
  const today = Temporal.Now.plainDateISO(activeTimeZone())
  const [selected, setSelected] = useState(date ? Temporal.PlainDate.from(date) : today)
  useReportDate(selected, onDateChange)
  const isRoomy = useRoomyScreen()

  const weekStart = activeWeekStart()
  const pages = monthPages(selected, weekStart)
  const events = useEventPages(pages.map(({ range }) => range))
  const calendars = useCalendars()
  const { move, movingKey } = useMoveEvent()
  const [lifted, setLifted] = useState<DragData>()
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
  const goToMonth = (direction: 1 | -1) => {
    setSelected(selected.add({ months: direction }))
  }
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
    <div className="flex h-dvh flex-col">
      <main className="flex min-h-0 flex-1 flex-col">
        <ListStatus isConnected={events.isSuccess} />
        <DateLine
          leading={<ListStartActions {...bar} />}
          actions={<ListEndActions {...bar} />}
          step="month"
          selected={selected}
          today={today}
          onSelect={setSelected}
        />
        <div className="flex min-h-0 flex-1 flex-col border-t">
          {isRoomy ? (
            <>
              <div className="border-b py-2">
                <WeekdayNames selected={selected} weekStart={weekStart} />
              </div>
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
                <MonthGrid
                  anchor={selected}
                  today={today}
                  events={events.data}
                  onEdit={onEdit}
                  onCreate={(day) => {
                    onCreate(day.toString())
                  }}
                  drag={{
                    isMovable,
                    movingKey,
                    menuId,
                    onMenuClose: () => {
                      setMenuId(undefined)
                    },
                  }}
                  onPage={goToMonth}
                />
                <EdgePaging weekKey={selected.with({ day: 1 }).toString()} onPage={goToMonth} />
                <DragOverlay dropAnimation={null}>
                  {lifted && (
                    <EventCard
                      entry={lifted.entry}
                      onEdit={noop}
                      look={cardLooks.lifted}
                      {...liftedProps}
                      className="h-full w-full"
                    />
                  )}
                </DragOverlay>
              </DndContext>
            </>
          ) : (
            <div className="my-auto flex flex-col items-center gap-4 px-6 pb-6 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Monitor className="size-8" />
              </span>
              <p className="text-lg font-semibold">
                <Trans>Screen is too small, use another view</Trans>
              </p>
              <Button
                variant="secondary"
                onClick={() => {
                  onChooseLayout('weekRows')
                }}
              >
                <Trans>Week</Trans>
              </Button>
            </div>
          )}
        </div>
      </main>

      <ListBottomBar>
        <ListActions {...bar} />
      </ListBottomBar>
    </div>
  )
}
