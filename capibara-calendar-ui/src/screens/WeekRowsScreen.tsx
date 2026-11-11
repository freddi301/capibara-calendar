import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import DateLine from '@/components/DateLine'
import DayRow from '@/components/DayRow'
import ListBottomBar from '@/components/ListBottomBar'
import ListStatus from '@/components/ListStatus'
import ServerError from '@/components/ServerError'
import { listEvents } from '@/lib/caldav'
import type { ListScreenProps } from '@/lib/layout'
import { activeTimeZone, activeWeekStart } from '@/lib/settings'
import { useSwipe } from '@/lib/swipe'
import { eventsOn, weekDays } from '@/lib/week'

export default function WeekRowsScreen({
  date,
  onCreate,
  onEdit,
  onOpenSettings,
  onOpenLayouts,
}: ListScreenProps) {
  const events = useQuery({ queryKey: ['events'], queryFn: listEvents })
  const today = Temporal.Now.plainDateISO(activeTimeZone())
  const [selected, setSelected] = useState(date ? Temporal.PlainDate.from(date) : today)
  const swipe = useSwipe((direction) => {
    setSelected(selected.add({ weeks: direction }))
  })

  return (
    <>
      <main className="mx-auto flex h-dvh max-w-md flex-col">
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
        onCreate={() => {
          onCreate(selected.toString())
        }}
      />
    </>
  )
}
