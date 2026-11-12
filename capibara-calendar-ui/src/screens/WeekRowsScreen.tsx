import { useState, type CSSProperties } from 'react'
import DateLine from '@/components/DateLine'
import DayRow from '@/components/DayRow'
import ListBottomBar, {
  ListActions,
  ListEndActions,
  ListStartActions,
} from '@/components/ListBottomBar'
import ListStatus from '@/components/ListStatus'
import ServerError from '@/components/ServerError'
import SnapPager from '@/components/SnapPager'
import type { ListScreenProps } from '@/lib/layout'
import { activeTimeZone, activeWeekStart } from '@/lib/settings'
import { useEventPages } from '@/lib/use-events'
import { useCardsAcross } from '@/lib/cards-across'
import { useReportDate } from '@/lib/use-report-date'
import { withViewTransition } from '@/lib/view-transition'
import { eventsOn, isFarPage, weekDays, weekPages } from '@/lib/week'

export default function WeekRowsScreen({
  date,
  onCreate,
  onEdit,
  onOpenSettings,
  onOpenLayouts,
  onOpenView,
  onOpenFilter,
  onDateChange,
}: ListScreenProps) {
  const today = Temporal.Now.plainDateISO(activeTimeZone())
  const [selected, setSelected] = useState(date ? Temporal.PlainDate.from(date) : today)
  useReportDate(selected, onDateChange)
  const weekStart = activeWeekStart()
  const { ref, cards } = useCardsAcross()
  const pages = weekPages(selected, weekStart)
  const events = useEventPages(pages.map(({ range }) => range))
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
    onOpenFilter,
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

        {/* The weeks are scrolled to, up for the next one and down for the one before. */}
        <div
          ref={ref}
          style={{ '--cards': cards } as CSSProperties}
          className="flex min-h-0 flex-1 flex-col border-t pb-0 phone:pb-12"
        >
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

      <ListBottomBar>
        <ListActions {...bar} />
      </ListBottomBar>
    </>
  )
}
