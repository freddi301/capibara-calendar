import { cn } from 'cn'
import { ChevronDown } from 'lucide-react'
import { useRef, useState, type CSSProperties } from 'react'
import DraggableEventCard from '@/components/DraggableEventCard'
import EventCard from '@/components/EventCard'
import { Button } from '@/components/ui/button'
import type { DisplayEvent } from '@/lib/display-event'
import { transitionNameOf } from '@/lib/move-event'
import type { DayEntry } from '@/lib/week'
import { entryKey } from '@/lib/week'

const maxDots = 5

const slot = cn(
  'size-[min(100cqw,calc(100cqh/6))] min-w-0 shrink-0 rounded-none p-0 hover:bg-foreground/10',
)

const cardLook = cn(
  'h-full w-full basis-auto snap-start snap-always rounded-l-none rounded-r-md [&_[data-slot=event-marks]]:right-2',
)

function pageHeight(node: HTMLElement, count: number) {
  return count > 1 ? (node.scrollHeight - node.clientHeight) / (count - 1) : node.clientHeight
}

export type EventDrag = {
  isMovable: (event: DisplayEvent) => boolean
  movingKey?: string
  menuId?: string
  onMenuClose: () => void
}

type DayEventsProps = {
  day: string
  entries: DayEntry[]
  onEdit: (event: DisplayEvent) => void
  drag: EventDrag
}

export default function DayEvents({ day, entries, onEdit, drag }: DayEventsProps) {
  const [index, setIndex] = useState(0)
  const scroller = useRef<HTMLDivElement>(null)
  const isMany = entries.length > 1
  const hasMore = entries.length > maxDots + 1
  const dots = hasMore ? entries.slice(0, maxDots) : entries
  const more = hasMore ? entries.at(maxDots) : undefined
  const goTo = (position: number) => {
    const node = scroller.current
    if (node) node.scrollTop = position * pageHeight(node, entries.length)
  }
  return (
    <>
      {isMany && (
        <div
          data-pager-ignore
          className="[container-type:size] absolute top-5 bottom-0 left-0 flex w-5.5 flex-col items-center overflow-hidden"
        >
          {dots.map((entry, position) => (
            <Button
              key={entryKey(entry)}
              variant="ghost"
              className={cn(slot, position === index && 'bg-foreground/20')}
              aria-label={entry.event.title}
              aria-current={position === index ? 'true' : undefined}
              onClick={() => {
                goTo(position)
              }}
            >
              <span
                aria-hidden="true"
                className="size-[calc(100%-2px)] rounded-full bg-[linear-gradient(to_bottom,var(--dot-top,var(--muted-foreground))_50%,var(--dot-bottom,var(--muted-foreground))_50%)]"
                style={
                  {
                    '--dot-top': entry.event.color,
                    '--dot-bottom': entry.event.eventColor ?? undefined,
                  } as CSSProperties
                }
              />
            </Button>
          ))}
          {more && (
            <Button
              variant="ghost"
              className={cn(slot, index >= maxDots && 'bg-foreground/20')}
              aria-label={more.event.title}
              aria-current={index >= maxDots ? 'true' : undefined}
              onClick={() => {
                goTo(maxDots)
              }}
            >
              <ChevronDown aria-hidden="true" className="size-full p-0.5" />
            </Button>
          )}
        </div>
      )}
      <div
        ref={scroller}
        data-pager-ignore
        className={cn(
          'absolute inset-y-0 right-0 left-5.5 flex snap-y snap-mandatory scroll-pt-2 [scrollbar-width:none] flex-col gap-2.5 overflow-y-auto scroll-smooth pt-2 pr-[2px] pb-[2px] [&::-webkit-scrollbar]:hidden',
          isMany && 'overscroll-contain',
        )}
        onScroll={(event) => {
          const node = event.currentTarget
          const height = pageHeight(node, entries.length)
          if (height) setIndex(Math.round(node.scrollTop / height))
        }}
      >
        {entries.map((entry) => {
          const transitionName =
            drag.movingKey === undefined ? undefined : transitionNameOf(entry.event, day)
          return drag.isMovable(entry.event) ? (
            <DraggableEventCard
              key={entryKey(entry)}
              entry={entry}
              day={day}
              isMoving={drag.movingKey === entry.event.key}
              transitionName={transitionName}
              isMenuOpen={drag.menuId === `${entryKey(entry)} ${day}`}
              onMenuClose={drag.onMenuClose}
              onEdit={onEdit}
              className={cardLook}
            />
          ) : (
            <EventCard
              key={entryKey(entry)}
              entry={entry}
              onEdit={onEdit}
              transitionName={transitionName}
              className={cardLook}
            />
          )
        })}
      </div>
    </>
  )
}
