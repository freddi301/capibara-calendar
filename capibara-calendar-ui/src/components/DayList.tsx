import { useState, type ComponentType } from 'react'
import DateLine from '@/components/DateLine'
import EventItem from '@/components/EventItem'
import EventsSection from '@/components/EventsSection'
import ListBottomBar from '@/components/ListBottomBar'
import ListStatus from '@/components/ListStatus'
import type { ListScreenProps } from '@/lib/layout'
import { activeTimeZone, activeWeekStart } from '@/lib/settings'
import { useEvents } from '@/lib/use-events'
import { useReportDate } from '@/lib/use-report-date'
import { eventsOn, entryKey, type DateRange } from '@/lib/week'

export type DayPickerProps = {
  selected: Temporal.PlainDate
  today: Temporal.PlainDate
  countOn: (day: Temporal.PlainDate) => number
  onSelect: (day: Temporal.PlainDate) => void
}

type DayListProps = ListScreenProps & {
  dayPicker: ComponentType<DayPickerProps>
  rangeAround: (selected: Temporal.PlainDate, weekStart: number) => DateRange
}

export default function DayList({
  date,
  dayPicker: DayPicker,
  rangeAround,
  onOpenLayouts,
  onOpenFilter,
  onDateChange,
  onCreate,
  onEdit,
  onOpenSettings,
}: DayListProps) {
  const today = Temporal.Now.plainDateISO(activeTimeZone())
  const [selected, setSelected] = useState(date ? Temporal.PlainDate.from(date) : today)
  useReportDate(selected, onDateChange)
  const events = useEvents(rangeAround(selected, activeWeekStart()))
  const rows = eventsOn(events.data ?? [], selected)

  return (
    <>
      <main className="mx-auto flex h-dvh flex-col">
        <ListStatus isConnected={events.isSuccess} />
        <DateLine selected={selected} today={today} onSelect={setSelected} />
        <DayPicker
          selected={selected}
          today={today}
          countOn={(day) => eventsOn(events.data ?? [], day).length}
          onSelect={setSelected}
        />

        <EventsSection isError={events.isError}>
          {rows.map((entry) => (
            <EventItem key={entryKey(entry)} entry={entry} onEdit={onEdit} />
          ))}
        </EventsSection>
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
