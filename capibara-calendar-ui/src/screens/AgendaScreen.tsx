import { useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import DateLine from '@/components/DateLine'
import EventItem from '@/components/EventItem'
import EventsSection from '@/components/EventsSection'
import ListBottomBar from '@/components/ListBottomBar'
import ListStatus from '@/components/ListStatus'
import { listEvents } from '@/lib/caldav'
import { capitalize, formatFullDate } from '@/lib/format'
import type { ListScreenProps } from '@/lib/layout'
import { activeTimeZone } from '@/lib/settings'
import { agendaDays, dayAtTop } from '@/lib/week'

export default function AgendaScreen({
  date,
  onCreate,
  onEdit,
  onOpenSettings,
  onOpenLayouts,
}: ListScreenProps) {
  const { i18n } = useLingui()
  const events = useQuery({ queryKey: ['events'], queryFn: listEvents })
  const today = Temporal.Now.plainDateISO(activeTimeZone())
  const [start, setStart] = useState(date ? Temporal.PlainDate.from(date) : today)
  const [selected, setSelected] = useState(start)
  const list = useRef<HTMLElement>(null)
  const days = agendaDays(events.data ?? [], start)

  const choose = (day: Temporal.PlainDate) => {
    setStart(day)
    setSelected(day)
    if (list.current) list.current.scrollTop = 0
  }

  return (
    <>
      <main className="mx-auto flex h-dvh max-w-md flex-col">
        <ListStatus isConnected={events.isSuccess} />
        <DateLine isSpaced isBordered selected={selected} today={today} onSelect={choose} />
        <EventsSection
          ref={list}
          isError={events.isError}
          onScroll={(event) => {
            const day = event.currentTarget.scrollTop
              ? dayAtTop(event.currentTarget)
              : start.toString()
            if (day && day !== selected.toString()) setSelected(Temporal.PlainDate.from(day))
          }}
        >
          {days.map(({ day, entries }) => (
            <div key={day.toString()} data-day={day.toString()} className="flex flex-col gap-2">
              <h2 className="px-1 pt-2 text-sm font-semibold text-muted-foreground">
                {capitalize(formatFullDate(day, i18n.locale), i18n.locale)}
              </h2>
              {entries.map((entry) => (
                <EventItem key={entry.event.url} entry={entry} onEdit={onEdit} />
              ))}
            </div>
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
