import { useLingui } from '@lingui/react/macro'
import { useLayoutEffect, useRef, useState } from 'react'
import DateLine from '@/components/DateLine'
import EventItem from '@/components/EventItem'
import EventsSection from '@/components/EventsSection'
import ListBottomBar from '@/components/ListBottomBar'
import ListStatus from '@/components/ListStatus'
import { capitalize, formatFullDate } from '@/lib/format'
import type { ListScreenProps } from '@/lib/layout'
import { activeTimeZone } from '@/lib/settings'
import { useEvents } from '@/lib/use-events'
import { useReportDate } from '@/lib/use-report-date'
import { agendaDays, agendaRange, dayAtTop, entryKey } from '@/lib/week'

export default function AgendaScreen({
  date,
  onCreate,
  onEdit,
  onOpenSettings,
  onOpenLayouts,
  onOpenFilter,
  onDateChange,
}: ListScreenProps) {
  const { i18n } = useLingui()
  const today = Temporal.Now.plainDateISO(activeTimeZone())
  const [start, setStart] = useState(date ? Temporal.PlainDate.from(date) : today)
  const [selected, setSelected] = useState(start)
  useReportDate(selected, onDateChange)
  const events = useEvents(agendaRange(start))
  const list = useRef<HTMLElement>(null)
  const days = agendaDays(events.data ?? [], start)

  useLayoutEffect(() => {
    if (list.current) list.current.scrollTop = 0
  }, [start])

  const choose = (day: Temporal.PlainDate) => {
    setStart(day)
    setSelected(day)
  }

  return (
    <>
      <main className="mx-auto flex h-dvh flex-col">
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
            <div
              key={day.toString()}
              data-day={day.toString()}
              className="flex flex-col gap-2 first:[&>h2]:pt-2"
            >
              <h2 className="px-1 pt-6 pb-3 text-center text-sm font-semibold text-muted-foreground">
                {capitalize(formatFullDate(day, i18n.locale), i18n.locale)}
              </h2>
              {entries.map((entry) => (
                <EventItem key={entryKey(entry)} entry={entry} onEdit={onEdit} />
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
        onOpenFilter={onOpenFilter}
        onCreate={() => {
          onCreate(selected.toString())
        }}
      />
    </>
  )
}
