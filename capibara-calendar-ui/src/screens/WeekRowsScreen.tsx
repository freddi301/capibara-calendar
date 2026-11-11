import { useState } from 'react'
import DateLine from '@/components/DateLine'
import DayRow from '@/components/DayRow'
import ListBottomBar from '@/components/ListBottomBar'
import ListStatus from '@/components/ListStatus'
import ServerError from '@/components/ServerError'
import SnapPager from '@/components/SnapPager'
import type { ListScreenProps } from '@/lib/layout'
import { activeTimeZone, activeWeekStart } from '@/lib/settings'
import { useEventPages } from '@/lib/use-events'
import { useReportDate } from '@/lib/use-report-date'
import { eventsOn, weekDays, weekPages } from '@/lib/week'

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
  const weekStart = activeWeekStart()
  const pages = weekPages(selected, weekStart)
  const events = useEventPages(pages.map(({ range }) => range))
  const [before, current, after] = pages.map(({ day: anchor }) => (
    <div key={anchor.toString()} className="flex h-full flex-col">
      {weekDays(anchor, weekStart).map((day) => (
        <DayRow
          key={day.toString()}
          day={day}
          isToday={day.equals(today)}
          entries={eventsOn(events.data, day)}
          onEdit={onEdit}
        />
      ))}
    </div>
  ))

  return (
    <>
      <main className="mx-auto flex h-dvh flex-col">
        <ListStatus isConnected={events.isSuccess} />
        <DateLine isSpaced selected={selected} today={today} onSelect={setSelected} />

        {/* The weeks are scrolled to, up for the next one and down for the one before. */}
        <div className="flex min-h-0 flex-1 flex-col border-t pb-12">
          {events.isError && <ServerError />}
          <SnapPager
            axis="y"
            centerKey={selected.toString()}
            className="min-h-0 flex-1"
            onPage={(direction) => {
              setSelected(selected.add({ weeks: direction }))
            }}
            pages={[before, current, after]}
          />
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
