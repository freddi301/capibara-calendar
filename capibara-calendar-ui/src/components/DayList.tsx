import { useLingui } from '@lingui/react/macro'
import { ChevronDown, ChevronUp, Coffee } from 'lucide-react'
import { useState, type ComponentType } from 'react'
import DateLine from '@/components/DateLine'
import EmptyState from '@/components/EmptyState'
import EventItem from '@/components/EventItem'
import EventsSection from '@/components/EventsSection'
import ListBottomBar from '@/components/ListBottomBar'
import ListStatus from '@/components/ListStatus'
import { Button } from '@/components/ui/button'
import type { ListScreenProps } from '@/lib/layout'
import { activeTimeZone, activeWeekStart } from '@/lib/settings'
import { useEventPages } from '@/lib/use-events'
import { useReportDate } from '@/lib/use-report-date'
import { withViewTransition } from '@/lib/view-transition'
import { eventsOn, entryKey, isFarPage, type DateRange } from '@/lib/week'

export type DayPickerProps = {
  selected: Temporal.PlainDate
  today: Temporal.PlainDate
  countOn: (day: Temporal.PlainDate) => number
  onSelect: (day: Temporal.PlainDate) => void
}

type DayListProps = ListScreenProps & {
  dayPicker: ComponentType<DayPickerProps>
  pickerToggle?: { isExpanded: boolean; label: string; onToggle: () => void }
  pagesAround: (
    selected: Temporal.PlainDate,
    weekStart: number,
  ) => { day: Temporal.PlainDate; range: DateRange }[]
}

export default function DayList({
  date,
  dayPicker: DayPicker,
  pagesAround,
  pickerToggle,
  onOpenLayouts,
  onOpenView,
  onOpenFilter,
  onDateChange,
  onCreate,
  onEdit,
  onOpenSettings,
}: DayListProps) {
  const { t } = useLingui()
  const today = Temporal.Now.plainDateISO(activeTimeZone())
  const [selected, setSelected] = useState(date ? Temporal.PlainDate.from(date) : today)
  useReportDate(selected, onDateChange)
  const weekStart = activeWeekStart()
  const events = useEventPages(pagesAround(selected, weekStart).map(({ range }) => range))
  const choose = (day: Temporal.PlainDate) => {
    if (isFarPage(pagesAround, selected, day, weekStart)) {
      withViewTransition(() => {
        setSelected(day)
      })
    } else setSelected(day)
  }
  const rows = eventsOn(events.data, selected)

  return (
    <>
      <main className="mx-auto flex h-dvh flex-col">
        <ListStatus isConnected={events.isSuccess} />
        <DateLine selected={selected} today={today} onSelect={choose} />
        <div data-vt="picker" className={pickerToggle && 'relative mb-3'}>
          <DayPicker
            selected={selected}
            today={today}
            countOn={(day) => eventsOn(events.data, day).length}
            onSelect={choose}
          />
          {pickerToggle && (
            <Button
              variant="outline"
              aria-label={pickerToggle.label}
              aria-expanded={pickerToggle.isExpanded}
              className="absolute right-4 bottom-0 z-10 size-7 translate-y-1/2 rounded-full bg-background p-0 text-muted-foreground hover:bg-muted dark:bg-background"
              onClick={pickerToggle.onToggle}
            >
              {pickerToggle.isExpanded ? (
                <ChevronUp className="size-4" />
              ) : (
                <ChevronDown className="size-4" />
              )}
            </Button>
          )}
        </div>

        <EventsSection isError={events.isError}>
          {events.isSuccess && rows.length === 0 && (
            <EmptyState icon={Coffee} title={t`Nothing planned`} hint={t`A free day. Enjoy it.`} />
          )}
          {rows.map((entry) => (
            <EventItem key={entryKey(entry)} entry={entry} onEdit={onEdit} />
          ))}
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
