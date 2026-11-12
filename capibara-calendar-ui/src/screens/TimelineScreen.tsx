import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import DateLine from '@/components/DateLine'
import ListBottomBar, {
  ListActions,
  ListEndActions,
  ListStartActions,
} from '@/components/ListBottomBar'
import ListStatus from '@/components/ListStatus'
import TimelineBlock from '@/components/TimelineBlock'
import { cardsFor } from '@/lib/cards-across'
import { capitalize, formatDay, formatWeekday } from '@/lib/format'
import type { ListScreenProps } from '@/lib/layout'
import { activeTimeZone } from '@/lib/settings'
import {
  axisMarks,
  daysBetween,
  blockSides,
  blocksBetween,
  daysOnScreen,
  laneWidth,
  layoutBlocks,
  minuteOf,
  pixelsPerMinute,
  type AxisMark,
  type TimelineScale,
} from '@/lib/timeline'
import { useElementSize, useScroller } from '@/lib/use-element-size'
import { useEvents } from '@/lib/use-events'
import { keepScroll, keptScroll, timelineScroll } from '@/lib/kept-scroll'
import { useReportDate } from '@/lib/use-report-date'

const gutterWidth = 56

const halfSpan = (scale: TimelineScale) => Math.ceil(daysOnScreen(scale) * 50) + 10

const dateKey = (date: Temporal.PlainDate) => date.toString()

function MarkLabel({
  mark,
  scale,
  today,
}: {
  mark: AxisMark
  scale: TimelineScale
  today: string
}) {
  const { i18n } = useLingui()
  const { date, hour } = mark
  const isDay = hour === undefined || hour === 0
  const text = !isDay
    ? `${String(hour).padStart(2, '0')}:00`
    : date.day === 1
      ? `${date.day} ${capitalize(formatDay(date, i18n.locale, { month: 'short' }), i18n.locale)}`
      : `${formatWeekday(date, i18n.locale)} ${date.day}`
  return (
    <div
      className={cn(
        'absolute inset-x-0 truncate px-1 text-center text-sm leading-5 tabular-nums',
        isDay ? 'font-bold text-foreground/80' : 'text-muted-foreground',
        isDay && dateKey(date) === today && 'text-primary dark:text-sidebar-primary',
        scale === 'day' && !isDay && 'font-normal',
      )}
      style={{ top: mark.top + 2 }}
    >
      {text}
    </div>
  )
}

type TimelineScreenProps = ListScreenProps & { scale: TimelineScale }

function TimelineScreen({
  scale,
  date,
  onCreate,
  onEdit,
  onOpenSettings,
  onOpenLayouts,
  onOpenView,
  onOpenFilter,
  onDateChange,
}: TimelineScreenProps) {
  const { tz } = { tz: activeTimeZone() }
  const today = Temporal.Now.plainDateISO(tz)
  const [kept] = useState(() => keptScroll(timelineScroll(scale), date))
  const first = Temporal.PlainDate.from(kept?.date ?? date ?? today.toString())
  const fraction = useRef(kept?.fraction ?? 0)
  const [anchor, setAnchor] = useState(first)
  const [selected, setSelected] = useState(first)
  useReportDate(selected, onDateChange)

  const { ref, width, height } = useElementSize()
  const { ref: scrollRef, scrollTo } = useScroller()
  const perMinute = height > 0 ? pixelsPerMinute(scale, height) : 0
  const dayHeight = perMinute * 24 * 60
  const span = halfSpan(scale)
  const origin = useMemo(() => anchor.subtract({ days: span }), [anchor, span])
  const total = 2 * span * dayHeight
  const across = cardsFor(width)
  const baseLane = Math.max(0, width - gutterWidth)

  const reach = Math.ceil(daysOnScreen(scale))
  const from = selected.subtract({ days: reach + 1 })
  const to = selected.add({ days: reach * 2 + 2 })
  const events = useEvents(
    { start: from.with({ day: 1 }).toString(), end: to.with({ day: to.daysInMonth }).toString() },
    { start: selected.toString(), end: selected.add({ days: reach }).toString() },
  )
  const blocks = useMemo(
    () => (perMinute > 0 ? layoutBlocks(events.data, origin, perMinute) : []),
    [events.data, origin, perMinute],
  )

  const [windowTop, setWindowTop] = useState(0)
  const near = { from: windowTop - height, to: windowTop + height * 3 }
  const shown = blocksBetween(blocks, near.from, near.to)
  const marks = perMinute > 0 ? axisMarks(scale, origin, perMinute, near.from, near.to) : []
  const lane = laneWidth(shown, baseLane, across)

  const [now, setNow] = useState(() => Temporal.Now.plainDateTimeISO(tz))
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Temporal.Now.plainDateTimeISO(tz))
    }, 30_000)
    return () => {
      window.clearInterval(timer)
    }
  }, [tz])
  const nowTop =
    perMinute > 0
      ? minuteOf(origin, now.toPlainDate().toString(), now.toPlainTime().toString().slice(0, 5)) *
        perMinute
      : -1

  const where = useRef({ anchor, selected })
  useEffect(() => {
    where.current = { anchor, selected }
  })
  useLayoutEffect(() => {
    if (dayHeight <= 0) return
    const { anchor: around, selected: top } = where.current
    scrollTo((span + daysBetween(around, top) + fraction.current) * dayHeight)
  }, [dayHeight, span, scrollTo])

  const windowAt = (top: number) => Math.floor(top / (height / 2)) * (height / 2)
  const goTo = (day: Temporal.PlainDate) => {
    fraction.current = 0
    keepScroll(timelineScroll(scale), { date: day.toString(), fraction: 0 })
    scrollTo(span * dayHeight)
    setWindowTop(windowAt(span * dayHeight))
    setAnchor(day)
    setSelected(day)
  }

  const onScroll = (top: number) => {
    if (dayHeight <= 0) return
    const days = Math.floor((top + 1) / dayHeight)
    const day = origin.add({ days })
    fraction.current = Math.min(Math.max((top - days * dayHeight) / dayHeight, 0), 1)
    keepScroll(timelineScroll(scale), { date: day.toString(), fraction: fraction.current })
    if (dateKey(day) !== dateKey(selected)) setSelected(day)
    if (windowAt(top) !== windowTop) setWindowTop(windowAt(top))
    const edge = (span / 2) * dayHeight
    if (top < edge || top > total - height - edge) {
      const again = span * dayHeight + (top - days * dayHeight)
      scrollTo(again)
      setWindowTop(windowAt(again))
      setAnchor(day)
    }
  }

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
          onSelect={goTo}
        />

        <div className="flex min-h-0 flex-1 flex-col border-t pb-0 phone:pb-12">
          <div ref={ref} className="relative min-h-0 flex-1">
            <div
              ref={scrollRef}
              data-slot="timeline"
              onScroll={(event) => {
                onScroll(event.currentTarget.scrollTop)
              }}
              className="absolute inset-0 overflow-auto overscroll-contain"
            >
              {perMinute > 0 && (
                <div className="flex" style={{ height: total, width: gutterWidth + lane }}>
                  <div
                    className="sticky left-0 z-10 shrink-0 border-r bg-background"
                    style={{ width: gutterWidth, height: total }}
                  >
                    <div className="relative size-full">
                      {marks.map((mark) => (
                        <MarkLabel
                          key={mark.top}
                          mark={mark}
                          scale={scale}
                          today={dateKey(today)}
                        />
                      ))}
                      {nowTop >= near.from && nowTop <= near.to && (
                        <div
                          className="absolute -right-1 size-2 -translate-y-1/2 rounded-full bg-primary"
                          style={{ top: nowTop }}
                        />
                      )}
                    </div>
                  </div>
                  <div className="relative" style={{ width: lane, height: total }}>
                    {marks.map((mark) => (
                      <div
                        key={mark.top}
                        className={cn(
                          'absolute inset-x-0 border-t',
                          mark.hour === undefined || mark.hour === 0
                            ? 'border-foreground/20'
                            : 'border-border/50',
                        )}
                        style={{ top: mark.top }}
                      />
                    ))}
                    {shown.map((block) => (
                      <TimelineBlock
                        key={`${block.event.key} ${block.event.startDate} ${block.event.startTime}`}
                        block={block}
                        onOpen={onEdit}
                        {...blockSides(block, baseLane, across)}
                      />
                    ))}
                    {nowTop >= near.from && nowTop <= near.to && (
                      <div
                        className="pointer-events-none absolute inset-x-0 h-px bg-primary"
                        style={{ top: nowTop }}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>

      <ListBottomBar>
        <ListActions {...bar} />
      </ListBottomBar>
    </>
  )
}

export function TimelineDayScreen(props: ListScreenProps) {
  return <TimelineScreen scale="day" {...props} />
}

export function TimelineWeekScreen(props: ListScreenProps) {
  return <TimelineScreen scale="week" {...props} />
}

export function TimelineMonthScreen(props: ListScreenProps) {
  return <TimelineScreen scale="month" {...props} />
}
