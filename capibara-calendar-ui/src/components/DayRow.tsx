import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import DayNumber from '@/components/DayNumber'
import EventCard from '@/components/EventCard'
import type { CalendarEvent } from '@/lib/caldav'
import { formatFullDate, formatWeekday } from '@/lib/format'
import { useScrollEdges } from '@/lib/use-scroll-edges'
import { entryKey, type DayEntry } from '@/lib/week'

// A half circle on an edge that has more beyond it: the row can be scrolled that way, and it is
// scrolled by one screen when it is pressed. It is over the card and takes no space of the row.
function ScrollHalfCircle({
  side,
  isShown,
  label,
  onPress,
}: {
  side: 'left' | 'right'
  isShown: boolean
  label: string
  onPress: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!isShown}
      tabIndex={isShown ? 0 : -1}
      data-slot="scroll-shadow"
      data-side={side}
      className={cn(
        'absolute top-1/2 flex h-8 w-4 -translate-y-1/2 items-center bg-primary/80 text-primary-foreground transition-opacity',
        side === 'left' ? 'left-0 rounded-r-full' : 'right-0 justify-end rounded-l-full',
        isShown ? 'opacity-100' : 'pointer-events-none opacity-0',
      )}
      onClick={onPress}
    >
      {side === 'left' ? (
        <ChevronLeft className="size-3.5 -translate-x-1" />
      ) : (
        <ChevronRight className="size-3.5 translate-x-1" />
      )}
    </button>
  )
}

type DayRowProps = {
  day: Temporal.PlainDate
  isToday: boolean
  isSelected: boolean
  entries: DayEntry[]
  onSelect: (day: Temporal.PlainDate) => void
  onEdit: (event: CalendarEvent) => void
}

export default function DayRow({
  day,
  isToday,
  isSelected,
  entries,
  onSelect,
  onEdit,
}: DayRowProps) {
  const { t, i18n } = useLingui()
  const { ref, edges, onScroll, scrollPage } = useScrollEdges(entries.length)
  return (
    <div
      role="group"
      aria-label={formatFullDate(day, i18n.locale)}
      className="flex min-h-0 flex-1 items-stretch gap-1"
    >
      {/* The name and the number of the day: pressed, the day is the one that is selected. */}
      <button
        type="button"
        aria-label={formatFullDate(day, i18n.locale)}
        aria-pressed={isSelected}
        className="flex w-12 shrink-0 flex-col items-center justify-center border-r outline-none focus-visible:bg-muted"
        onClick={() => {
          onSelect(day)
        }}
      >
        <span aria-hidden="true" className="text-xs text-muted-foreground">
          {formatWeekday(day, i18n.locale)}
        </span>
        <DayNumber day={day} isSelected={isSelected} isToday={isToday} isCompact />
      </button>
      {/* The list goes to the border of the screen, where the cards are cut; the gap is at its end. */}
      <div className="relative -ml-1 min-w-0 flex-1">
        <div
          ref={ref}
          onScroll={onScroll}
          className="flex h-full snap-x snap-mandatory scroll-px-1 [scrollbar-width:none] items-stretch gap-1.5 overflow-x-auto px-1 pt-2 pb-1 [&::-webkit-scrollbar]:hidden"
        >
          {entries.map((entry) => (
            <EventCard key={entryKey(entry)} entry={entry} onEdit={onEdit} />
          ))}
        </div>
        <ScrollHalfCircle
          side="left"
          isShown={edges.left}
          label={t`Scroll left`}
          onPress={() => {
            scrollPage(-1)
          }}
        />
        <ScrollHalfCircle
          side="right"
          isShown={edges.right}
          label={t`Scroll right`}
          onPress={() => {
            scrollPage(1)
          }}
        />
      </div>
    </div>
  )
}
