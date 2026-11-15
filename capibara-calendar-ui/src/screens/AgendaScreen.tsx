import { useLingui } from '@lingui/react/macro'
import { useVirtualizer } from '@tanstack/react-virtual'
import { CalendarCheck, Funnel } from 'lucide-react'
import { hasRules } from '@/lib/event-filter'
import { useEventFilter } from '@/lib/event-filter-store'
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
import { capitalize, formatFullDate } from '@/lib/format'
import type { ListScreenProps } from '@/lib/layout'
import { activeTimeZone } from '@/lib/settings'
import { useEvents } from '@/lib/use-events'
import { useReportDate } from '@/lib/use-report-date'
import { agendaScroll, alignStart, keepScroll, keptScroll } from '@/lib/kept-scroll'
import { offsetInDay } from '@/lib/week'
import { withViewTransition } from '@/lib/view-transition'
import { agendaDays, agendaFirstMonths, agendaMoreMonths, agendaRange, dayAtTop } from '@/lib/week'

const estimatedDayHeight = 130
const virtualFrom = 60

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
  const isFiltered = hasRules(useEventFilter())
  const today = Temporal.Now.plainDateISO(activeTimeZone())
  const [kept] = useState(() => keptScroll(agendaScroll, date))
  const [start, setStart] = useState(() =>
    Temporal.PlainDate.from(kept?.start ?? date ?? today.toString()),
  )
  const [selected, setSelected] = useState(() =>
    kept ? Temporal.PlainDate.from(kept.date) : start,
  )
  useReportDate(selected, onDateChange)
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
  const isVirtual = days.length > virtualFrom
  const virtualizer = useVirtualizer({
    count: isVirtual ? days.length : 0,
    getScrollElement: () => list.current,
    estimateSize: () => estimatedDayHeight,
    overscan: 5,
    initialRect: { width: 0, height: window.innerHeight },
    getItemKey: (index) => days[index].day.toString(),
  })

  const isKept = useRef(true)
  const isDone = useRef(false)
  const goal = useRef(0)
  const lastStart = useRef(start)
  useLayoutEffect(() => {
    if (!list.current) return
    if (lastStart.current !== start) {
      lastStart.current = start
      isDone.current = false
    }
    if (isDone.current) return
    const was = isKept.current && kept?.start === start.toString() ? kept : undefined
    const index =
      isVirtual && was?.day ? days.findIndex(({ day }) => day.toString() === was.day) : -1
    const offset = index >= 0 ? virtualizer.getOffsetForIndex(index, alignStart)?.[0] : undefined
    goal.current = offset === undefined ? (was?.scrollTop ?? 0) : offset + (was?.offset ?? 0)
    list.current.scrollTop = goal.current
  }, [start, kept, days.length, isVirtual])
  useEffect(() => {
    keepScroll(agendaScroll, {
      date: selected.toString(),
      start: start.toString(),
      scrollTop: list.current?.scrollTop ?? 0,
    })
  }, [start, selected])

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
          index === 0 ? 'pt-0' : 'pt-4', // the space between the days is of the day: it is measured with it
          start !== undefined && 'absolute top-0 left-0 w-full',
        )}
        style={start === undefined ? undefined : { transform: `translateY(${start}px)` }}
      >
        <h2 className="-mx-2 flex justify-center border-b px-2 py-2 text-center">
          <span className="px-3 py-1 text-sm font-semibold text-foreground/80">
            {capitalize(formatFullDate(day, i18n.locale), i18n.locale)}
          </span>
        </h2>
        <EventLanes entries={entries} onEdit={onEdit} />
      </div>
    )
  }

  const choose = (day: Temporal.PlainDate) => {
    isKept.current = false
    withViewTransition(() => {
      setStart(day)
      setSelected(day)
    })
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
            isDone.current = true
          }}
          onScroll={(event) => {
            const top = event.currentTarget.scrollTop
            if (top > 0 && Math.abs(top - goal.current) > 2) isDone.current = true
            if (!isComplete && isShort(event.currentTarget)) askMore()
            const day = event.currentTarget.scrollTop
              ? dayAtTop(event.currentTarget)
              : start.toString()
            if (day && day !== selected.toString()) setSelected(Temporal.PlainDate.from(day))
            keepScroll(agendaScroll, {
              date: day ?? selected.toString(),
              start: start.toString(),
              scrollTop: event.currentTarget.scrollTop,
              ...offsetInDay(event.currentTarget, day),
            })
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

      <ListBottomBar>
        <ListActions {...bar} />
      </ListBottomBar>
    </>
  )
}
