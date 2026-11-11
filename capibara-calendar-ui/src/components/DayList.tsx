import { useQuery } from '@tanstack/react-query'
import { useState, type ComponentType } from 'react'
import DateLine from '@/components/DateLine'
import EventItem from '@/components/EventItem'
import EventsSection from '@/components/EventsSection'
import ListBottomBar from '@/components/ListBottomBar'
import ListStatus from '@/components/ListStatus'
import { listEvents } from '@/lib/caldav'
import type { ListScreenProps } from '@/lib/layout'
import { activeTimeZone } from '@/lib/settings'
import { eventsOn } from '@/lib/week'

// What a screen shows to choose the day: a week strip or a month table.
export type DayPickerProps = {
  selected: Temporal.PlainDate
  today: Temporal.PlainDate
  countOn: (day: Temporal.PlainDate) => number
  onSelect: (day: Temporal.PlainDate) => void
}

type DayListProps = ListScreenProps & { dayPicker: ComponentType<DayPickerProps> }

export default function DayList({
  date,
  dayPicker: DayPicker,
  onOpenLayouts,
  onCreate,
  onEdit,
  onOpenSettings,
}: DayListProps) {
  const events = useQuery({ queryKey: ['events'], queryFn: listEvents })
  const today = Temporal.Now.plainDateISO(activeTimeZone())
  const [selected, setSelected] = useState(date ? Temporal.PlainDate.from(date) : today)
  const rows = eventsOn(events.data ?? [], selected)

  return (
    <>
      <main className="mx-auto flex h-dvh max-w-md flex-col">
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
            <EventItem key={entry.event.url} entry={entry} onEdit={onEdit} />
          ))}
        </EventsSection>
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
