import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { useEffect, useLayoutEffect, useRef } from 'react'
import type { EventDrag } from '@/components/DayEvents'
import MonthCell from '@/components/MonthCell'
import type { DisplayEvent } from '@/lib/display-event'
import { capitalize, formatDay } from '@/lib/format'
import { activeWeekStart } from '@/lib/settings'
import { eventsOn, monthStrip } from '@/lib/week'

const settleDelay = 120

type MonthGridProps = {
  anchor: Temporal.PlainDate
  today: Temporal.PlainDate
  events: DisplayEvent[]
  onEdit: (event: DisplayEvent) => void
  onCreate: (day: Temporal.PlainDate) => void
  drag: EventDrag
  onPage: (direction: 1 | -1) => void
}

const rowHeight = (node: HTMLElement) => node.firstElementChild?.getBoundingClientRect().height ?? 0

export default function MonthGrid({
  anchor,
  today,
  events,
  onEdit,
  onCreate,
  drag,
  onPage,
}: MonthGridProps) {
  const { i18n } = useLingui()
  const weekStart = activeWeekStart()
  const scroller = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const month = anchor.with({ day: 1 })
  const name = capitalize(
    formatDay(anchor, i18n.locale, { month: 'long', year: 'numeric' }),
    i18n.locale,
  )
  const { weeks, snaps } = monthStrip(month, weekStart)
  const [, current, next] = snaps
  const monthKey = month.toString()

  useLayoutEffect(() => {
    const node = scroller.current
    if (!node) return
    const recenter = () => {
      const row = rowHeight(node)
      if (row) node.scrollTop = current * row
    }
    recenter()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(recenter)
    observer.observe(node)
    return () => {
      observer.disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthKey])

  useEffect(
    () => () => {
      window.clearTimeout(timer.current)
    },
    [],
  )

  const settle = () => {
    const node = scroller.current
    const row = node ? rowHeight(node) : 0
    if (!node || !row) return
    const at = node.scrollTop / row
    const nearest = snaps.reduce((best, index) =>
      Math.abs(index - at) < Math.abs(best - at) ? index : best,
    )
    if (nearest === 0) onPage(-1)
    else if (nearest === next) onPage(1)
  }

  return (
    <div className="[container-type:size] min-h-0 flex-1">
      <div
        ref={scroller}
        role="grid"
        data-slot="pager"
        aria-label={name}
        className="h-full snap-y snap-mandatory [scrollbar-width:none] overflow-x-hidden overflow-y-auto [overflow-anchor:none] [&::-webkit-scrollbar]:hidden"
        onScroll={() => {
          window.clearTimeout(timer.current)
          timer.current = window.setTimeout(settle, settleDelay)
        }}
      >
        {weeks.map((week, index) => (
          <div
            key={week[0].toString()}
            role="row"
            className={cn(
              'grid h-[calc(100cqh/6)] grid-cols-7 border-b',
              snaps.includes(index) && 'snap-start snap-always',
            )}
          >
            {week.map((day) => (
              <MonthCell
                key={day.toString()}
                day={day}
                isToday={day.equals(today)}
                entries={eventsOn(events, day)}
                onEdit={onEdit}
                onCreate={onCreate}
                drag={drag}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
