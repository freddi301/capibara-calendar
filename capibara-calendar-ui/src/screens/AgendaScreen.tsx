import { useLingui } from '@lingui/react/macro'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from 'cn'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
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
import { withViewTransition } from '@/lib/view-transition'
import {
  agendaDays,
  agendaFirstMonths,
  agendaMoreMonths,
  agendaRange,
  dayAtTop,
  entryKey,
} from '@/lib/week'

const estimatedDayHeight = 130
// The number of days with events from which the list is virtualized.
const virtualFrom = 60

export default function AgendaScreen({
  date,
  onCreate,
  onEdit,
  onOpenSettings,
  onOpenLayouts,
  onOpenView,
  onOpenFilter,
  onDateChange,
}: ListScreenProps) {
  const { i18n } = useLingui()
  const today = Temporal.Now.plainDateISO(activeTimeZone())
  const [start, setStart] = useState(date ? Temporal.PlainDate.from(date) : today)
  const [selected, setSelected] = useState(start)
  useReportDate(selected, onDateChange)
  // The months of the year are asked for as the list gets to its end, not all of them at once.
  const [asked, setAsked] = useState({ start, months: agendaFirstMonths })
  if (!asked.start.equals(start)) setAsked({ start, months: agendaFirstMonths })
  const events = useEvents(agendaRange(start, asked.months), agendaRange(start, agendaFirstMonths))
  const list = useRef<HTMLElement>(null)
  const askMore = () => {
    setAsked((current) => ({ ...current, months: current.months + agendaMoreMonths }))
  }
  const isShort = (list: HTMLElement) =>
    list.scrollHeight - list.scrollTop - list.clientHeight < list.clientHeight
  const isComplete = agendaRange(start, asked.months).end === agendaRange(start).end
  useEffect(() => {
    if (events.isSuccess && !isComplete && list.current && isShort(list.current)) askMore()
  })
  const days = useMemo(() => agendaDays(events.data, start), [events.data, start])
  // A list of a few days is made all at once; the one of a year of busy days only shows the days that
  // are on the screen, and a few around them.
  const isVirtual = days.length > virtualFrom
  // The virtualizer returns functions that change: the component is not memoized, which is as it is.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: isVirtual ? days.length : 0,
    getScrollElement: () => list.current,
    estimateSize: () => estimatedDayHeight,
    overscan: 5,
    initialRect: { width: 0, height: window.innerHeight },
    getItemKey: (index) => days[index].day.toString(),
  })

  useLayoutEffect(() => {
    if (list.current) list.current.scrollTop = 0
  }, [start])

  const dayBlock = (index: number, start?: number) => {
    const { day, entries } = days[index]
    return (
      <div
        key={day.toString()}
        ref={start === undefined ? undefined : virtualizer.measureElement}
        data-index={start === undefined ? undefined : index}
        data-day={day.toString()}
        className={cn(
          'flex flex-col gap-2',
          index === 0 && '[&>h2]:pt-2',
          start !== undefined && 'absolute top-0 left-0 w-full',
        )}
        style={start === undefined ? undefined : { transform: `translateY(${start}px)` }}
      >
        <h2 className="px-1 pt-6 pb-3 text-center text-sm font-semibold text-muted-foreground">
          {capitalize(formatFullDate(day, i18n.locale), i18n.locale)}
        </h2>
        {entries.map((entry) => (
          <EventItem key={entryKey(entry)} entry={entry} onEdit={onEdit} />
        ))}
      </div>
    )
  }

  const choose = (day: Temporal.PlainDate) => {
    withViewTransition(() => {
      setStart(day)
      setSelected(day)
    })
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
            if (!isComplete && isShort(event.currentTarget)) askMore()
            const day = event.currentTarget.scrollTop
              ? dayAtTop(event.currentTarget)
              : start.toString()
            if (day && day !== selected.toString()) setSelected(Temporal.PlainDate.from(day))
          }}
        >
          {isVirtual ? (
            <div
              className="relative w-full shrink-0"
              style={{ height: virtualizer.getTotalSize() }}
            >
              {virtualizer.getVirtualItems().map((item) => dayBlock(item.index, item.start))}
            </div>
          ) : (
            days.map((_, index) => dayBlock(index))
          )}
        </EventsSection>
      </main>

      <ListBottomBar
        onOpenSettings={onOpenSettings}
        onOpenLayouts={() => {
          onOpenLayouts(selected.toString())
        }}
        onOpenView={() => {
          onOpenView(selected.toString())
        }}
        onOpenFilter={onOpenFilter}
        onCreate={() => {
          onCreate(selected.toString())
        }}
      />
    </>
  )
}
