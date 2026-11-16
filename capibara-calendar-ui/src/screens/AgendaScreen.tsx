import { useLingui } from '@lingui/react/macro'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CalendarCheck, ChevronDown, ChevronUp, Funnel } from 'lucide-react'
import { hasRules } from '@/lib/event-filter'
import { cn } from 'cn'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import DateLine from '@/components/DateLine'
import EventLanes from '@/components/EventLanes'
import EmptyState from '@/components/EmptyState'
import EventsSection from '@/components/EventsSection'
import ListBottomBar, {
  ListActions,
  ListEndActions,
  ListStartActions,
} from '@/components/ListBottomBar'
import ListStatus from '@/components/ListStatus'
import { Button } from '@/components/ui/button'
import { capitalize, formatFullDate } from '@/lib/format'
import type { ListScreenProps } from '@/lib/layout'
import { activeTimeZone } from '@/lib/settings'
import { useEvents } from '@/lib/use-events'
import { useReportDate } from '@/lib/use-report-date'
import { agendaScroll, keepScroll, keptScroll } from '@/lib/kept-scroll'
import { withViewTransition } from '@/lib/view-transition'
import {
  agendaDays,
  agendaFirstReach,
  agendaGapMonths,
  agendaMoreMonths,
  agendaRange,
  monthsApart,
  onListKey,
  type DayEntry,
} from '@/lib/week'
import { useStored } from '@/lib/use-stored'

const estimatedDayHeight = 130
const estimatedButtonHeight = 48
const dayGap = 16 // the space above each day, but the first one

type Side = 'past' | 'future'
const earlier: Side = 'past'
type Row = { key: string; side?: Side; day?: Temporal.PlainDate; entries: DayEntry[] }
type Hold = { day: string; offset?: number }

export default function AgendaScreen({
  date,
  onCreate,
  onEdit,
  onOpenSettings,
  onOpenLayouts,
  onOpenView,
  onOpenCalendars,
  onOpenFilters,
  onDateChange,
}: ListScreenProps) {
  const { t, i18n } = useLingui()
  const isFiltered = hasRules(useStored((stored) => stored.eventFilter))
  const today = Temporal.Now.plainDateISO(activeTimeZone())
  const [kept] = useState(() => keptScroll(agendaScroll, date))
  const [view, setView] = useState(() => ({
    anchor: Temporal.PlainDate.from(date ?? today.toString()),
    ...agendaFirstReach,
  }))
  const [selected, setSelected] = useState(() =>
    kept ? Temporal.PlainDate.from(kept.date) : view.anchor,
  )
  useReportDate(selected, onDateChange)
  const range = agendaRange(view.anchor, view)
  const events = useEvents(range, agendaRange(view.anchor, agendaFirstReach))
  const list = useRef<HTMLElement>(null)
  const asked = useRef('')
  const grow = (side: Side, months = agendaMoreMonths) => {
    setView((current) => ({ ...current, [side]: current[side] + months }))
  }
  const days = useMemo(
    () => agendaDays(events.data, { start: range.start, end: range.end }),
    [events.data, range.start, range.end],
  )
  const emptyBefore = monthsApart(range.start, days[0]?.day.toString() ?? range.end)
  const emptyAfter = monthsApart(days.at(-1)?.day.toString() ?? range.start, range.end)
  const isGapBefore = days.length > 0 && emptyBefore >= agendaGapMonths
  const isGapAfter = days.length > 0 && emptyAfter >= agendaGapMonths
  const rows = useMemo<Row[]>(
    () => [
      ...(isGapBefore ? [{ key: 'before', side: 'past' as const, entries: [] }] : []),
      ...days.map(({ day, entries }) => ({ key: day.toString(), day, entries })),
      ...(isGapAfter ? [{ key: 'after', side: 'future' as const, entries: [] }] : []),
    ],
    [days, isGapBefore, isGapAfter],
  )
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => list.current,
    estimateSize: (index) => (rows[index].side ? estimatedButtonHeight : estimatedDayHeight),
    overscan: 5,
    initialRect: { width: 0, height: window.innerHeight },
    getItemKey: (index) => rows[index].key,
  })

  const askMore = (element: HTMLElement) => {
    if (!events.isLoaded) return
    const ask = (side: Side) => {
      const key = `${side} ${view[side]}`
      if (asked.current === key) return
      asked.current = key
      grow(side)
    }
    if (element.scrollTop < element.clientHeight && emptyBefore < agendaGapMonths) ask('past')
    const below = element.scrollHeight - element.scrollTop - element.clientHeight
    if (below < element.clientHeight && emptyAfter < agendaGapMonths) ask('future')
  }
  useEffect(() => {
    if (list.current) askMore(list.current)
  })

  const isLanding = useRef(true)
  const hold = useRef<Hold>(
    kept?.day ? { day: kept.day, offset: kept.offset } : { day: view.anchor.toString() },
  )
  /** The day at the top of the list, and how far the list is scrolled into it. */
  const topOf = (scrollTop: number): Hold | undefined => {
    const measured = virtualizer.measurementsCache
    const at = virtualizer.getVirtualItemForOffset(scrollTop)?.index ?? 0
    const found = rows.findIndex((row, index) => index >= at && row.day)
    const index = found >= 0 ? found : rows.findLastIndex((row) => row.day)
    const day = index >= 0 ? rows[index].day : undefined
    return day ? { day: day.toString(), offset: scrollTop - measured[index].start } : undefined
  }
  const land = () => {
    const element = list.current
    const target = hold.current
    if (!element) return
    const found = rows.findIndex((row) => row.day && row.day.toString() >= target.day)
    const index = found >= 0 ? found : rows.findLastIndex((row) => row.day)
    if (index < 0) return
    if (!isLanding.current && topOf(element.scrollTop)?.day === target.day) return
    const offset = target.offset ?? (index === 0 ? 0 : dayGap)
    const top = Math.max(0, virtualizer.measurementsCache[index].start + offset)
    if (Math.abs(element.scrollTop - top) > 1) element.scrollTop = top
  }
  useLayoutEffect(land, [rows])
  useEffect(() => {
    return onListKey(list.current, () => {
      isLanding.current = false
    })
  }, [])
  useEffect(() => {
    keepScroll(agendaScroll, {
      date: selected.toString(),
      day: hold.current.day,
      offset: hold.current.offset,
    })
  }, [selected])

  const rowBlock = (index: number, start: number) => {
    const row = rows[index]
    const { side } = row
    if (side) {
      const isPast = side === earlier
      return (
        <div
          key={row.key}
          ref={virtualizer.measureElement}
          data-index={index}
          style={{ transform: `translateY(${start}px)` }}
          className="absolute top-0 left-0 flex w-full justify-center py-2"
        >
          <Button
            variant="outline"
            onClick={() => {
              grow(side, agendaGapMonths)
            }}
          >
            {isPast ? <ChevronUp /> : <ChevronDown />}
            {isPast ? t`Load earlier events` : t`Load later events`}
          </Button>
        </div>
      )
    }
    return (
      <div
        key={row.key}
        ref={virtualizer.measureElement}
        data-index={index}
        style={{ transform: `translateY(${start}px)` }}
        data-day={row.key}
        className={cn(
          'absolute top-0 left-0 flex w-full flex-col gap-2',
          index === 0 ? 'pt-0' : 'pt-4', // the space between the days is of the day: it is measured with it
        )}
      >
        <h2 className="-mx-2 flex justify-center border-b px-2 py-2 text-center">
          <span className="px-3 py-1 text-sm font-semibold text-foreground/80">
            {row.day && capitalize(formatFullDate(row.day, i18n.locale), i18n.locale)}
          </span>
        </h2>
        <EventLanes entries={row.entries} onEdit={onEdit} />
      </div>
    )
  }

  const choose = (day: Temporal.PlainDate) => {
    const iso = day.toString()
    const isLoaded = iso >= range.start && iso <= range.end
    isLanding.current = true
    hold.current = { day: iso }
    withViewTransition(() => {
      setSelected(day)
      if (!isLoaded) setView({ anchor: day, ...agendaFirstReach })
    })
    if (isLoaded) land()
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
    <>
      <main className="mx-auto flex h-dvh flex-col">
        <ListStatus isConnected={events.isSuccess} />
        <DateLine
          leading={<ListStartActions {...bar} />}
          actions={<ListEndActions {...bar} />}
          isBordered
          selected={selected}
          today={today}
          onSelect={choose}
        />
        <EventsSection
          ref={list}
          onUserScroll={() => {
            isLanding.current = false
          }}
          onScroll={(event) => {
            const element = event.currentTarget
            askMore(element)
            const top = isLanding.current ? undefined : topOf(element.scrollTop)
            if (!top) return
            hold.current = top
            keepScroll(agendaScroll, { date: top.day, day: top.day, offset: top.offset })
            if (top.day !== selected.toString()) setSelected(Temporal.PlainDate.from(top.day))
          }}
        >
          {events.isSuccess && days.length === 0 && isFiltered && (
            <EmptyState
              icon={Funnel}
              title={t`No event matches the filter`}
              hint={t`Open the filter to change the rules.`}
            />
          )}
          {events.isSuccess && days.length === 0 && !isFiltered && (
            <EmptyState
              icon={CalendarCheck}
              title={t`Nothing planned`}
              hint={t`The events that come will be here.`}
            />
          )}
          <div className="relative w-full shrink-0" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((item) => rowBlock(item.index, item.start))}
          </div>
        </EventsSection>
      </main>

      <ListBottomBar>
        <ListActions {...bar} />
      </ListBottomBar>
    </>
  )
}
