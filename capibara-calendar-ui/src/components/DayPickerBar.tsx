import { useLingui } from '@lingui/react/macro'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'
import MonthTable from '@/components/MonthTable'
import WeekStrip from '@/components/WeekStrip'
import { Button } from '@/components/ui/button'
import { activeWeekStart } from '@/lib/settings'
import { useEventPages } from '@/lib/use-events'
import { getStored, setStored, type Stored } from '@/lib/use-stored'
import { withViewTransition } from '@/lib/view-transition'
import { eventsOn, monthPages, weekPages } from '@/lib/week'

export type DayPickerProps = {
  /** The day that is highlighted. */
  selected: Temporal.PlainDate
  /** The day whose week or month is shown: the picker can be paged away from the selected day. */
  anchor: Temporal.PlainDate
  today: Temporal.PlainDate
  countOn: (day: Temporal.PlainDate) => number
  onSelect: (day: Temporal.PlainDate) => void
  onPage: (direction: 1 | -1) => void
}

type PickerMode = Stored['pickerMode']

type DayPickerBarProps = {
  selected: Temporal.PlainDate
  today: Temporal.PlainDate
  onSelect: (day: Temporal.PlainDate) => void
}

/** The week strip or the month table. Paging it does not change the selected day. */
export default function DayPickerBar({ selected, today, onSelect }: DayPickerBarProps) {
  const { t } = useLingui()
  const [mode, setMode] = useState(() => getStored().pickerMode)
  const [anchor, setAnchor] = useState(selected)
  const [followed, setFollowed] = useState(selected)
  if (followed !== selected) {
    setFollowed(selected)
    setAnchor(selected)
  }
  const isMonth = mode === 'month'
  const pagesAround = isMonth ? monthPages : weekPages
  const events = useEventPages(pagesAround(anchor, activeWeekStart()).map(({ range }) => range))
  const Picker = isMonth ? MonthTable : WeekStrip

  return (
    <div data-vt="picker" className="relative">
      <Picker
        selected={selected}
        anchor={anchor}
        today={today}
        countOn={(day) => eventsOn(events.data, day).length}
        onSelect={onSelect}
        onPage={(direction) => {
          setAnchor((current) =>
            current.add(isMonth ? { months: direction } : { weeks: direction }),
          )
        }}
      />
      <div data-vt="toggle" className="absolute right-4 bottom-0 z-10 translate-y-1/2">
        <Button
          variant="outline"
          aria-label={isMonth ? t`Show the week` : t`Show the month`}
          aria-expanded={isMonth}
          className="size-7 rounded-full bg-background p-0 text-muted-foreground hover:bg-muted dark:bg-background dark:hover:bg-muted"
          onClick={() => {
            const next: PickerMode = isMonth ? 'week' : 'month'
            setStored({ pickerMode: next })
            withViewTransition(
              () => {
                setMode(next)
                setAnchor(selected)
              },
              { kind: 'toggle' },
            )
          }}
        >
          {isMonth ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
