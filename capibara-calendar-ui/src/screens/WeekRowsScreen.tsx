import { useState } from 'react'
import DateLine from '@/components/DateLine'
import DayRow from '@/components/DayRow'
import ListBottomBar from '@/components/ListBottomBar'
import ListStatus from '@/components/ListStatus'
import ServerError from '@/components/ServerError'
import type { ListScreenProps } from '@/lib/layout'
import { activeTimeZone, activeWeekStart } from '@/lib/settings'
import { useSwipe } from '@/lib/swipe'
import { useEvents } from '@/lib/use-events'
import { useReportDate } from '@/lib/use-report-date'
import { eventsOn, weekDays, weekRange } from '@/lib/week'

export default function WeekRowsScreen({
  date,
  onCreate,
  onEdit,
  onOpenSettings,
  onOpenLayouts,
  onOpenFilter,
  onDateChange,
}: ListScreenProps) {
  const today = Temporal.Now.plainDateISO(activeTimeZone())
  const [selected, setSelected] = useState(date ? Temporal.PlainDate.from(date) : today)
  useReportDate(selected, onDateChange)
  const events = useEvents(weekRange(selected, activeWeekStart()))
  const swipe = useSwipe((direction) => {
    setSelected(selected.add({ weeks: direction }))
  })

  return (
    <>
      <main className="mx-auto flex h-dvh flex-col">
        <ListStatus isConnected={events.isSuccess} />
        <DateLine isSpaced selected={selected} today={today} onSelect={setSelected} />

        <div
          {...swipe}
          className="flex min-h-0 flex-1 touch-pan-y flex-col border-t pb-12 select-none"
        >
          {events.isError && <ServerError />}
          {weekDays(selected, activeWeekStart()).map((day) => (
            <DayRow
              key={day.toString()}
              day={day}
              isToday={day.equals(today)}
              entries={eventsOn(events.data ?? [], day)}
              onEdit={onEdit}
            />
          ))}
        </div>
      </main>

      <ListBottomBar
        onOpenSettings={onOpenSettings}
        onOpenLayouts={() => {
          onOpenLayouts(selected.toString())
        }}
        onOpenFilter={onOpenFilter}
        onCreate={() => {
          onCreate(selected.toString())
        }}
      />
    </>
  )
}
