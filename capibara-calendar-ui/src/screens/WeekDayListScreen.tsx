import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { useQuery } from '@tanstack/react-query'
import { cn } from 'cn'
import { Plus, Settings } from 'lucide-react'
import { useState } from 'react'
import BottomBar from '@/components/BottomBar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { listEvents, type CalendarEvent } from '@/lib/caldav'
import { formatTime, usesTwelveHours } from '@/lib/format'
import { openPicker } from '@/lib/picker'
import { activeTimeZone, activeWeekStart } from '@/lib/settings'
import { eventsOn, weekDays } from '@/lib/week'

type WeekDayListScreenProps = {
  onCreate: (date: string) => void
  onEdit: (event: CalendarEvent) => void
  onOpenSettings: () => void
}

type TextSelectProps = {
  label: string
  items: { value: string; label: string }[]
  value: string
  onChange: (value: string) => void
}

function TextSelect({ label, items, value, onChange }: TextSelectProps) {
  return (
    <Select
      items={items}
      value={value}
      onValueChange={(choice) => {
        if (choice) onChange(choice)
      }}
    >
      <SelectTrigger
        aria-label={label}
        className="h-auto w-fit gap-0 border-0 bg-transparent p-0 text-lg font-semibold shadow-none data-[size=default]:h-auto dark:bg-transparent dark:hover:bg-transparent [&_svg]:hidden"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value}>
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const yearsAround = 10

export default function WeekDayListScreen({
  onCreate,
  onEdit,
  onOpenSettings,
}: WeekDayListScreenProps) {
  const { t, i18n } = useLingui()
  const events = useQuery({ queryKey: ['events'], queryFn: listEvents })
  const timeZone = activeTimeZone()
  const today = Temporal.Now.plainDateISO(timeZone)
  const [selected, setSelected] = useState(today)

  const format = (date: Temporal.PlainDate, options: Intl.DateTimeFormatOptions) =>
    date.toLocaleString(i18n.locale, options)
  const capitalize = (text: string) => text.charAt(0).toLocaleUpperCase(i18n.locale) + text.slice(1)
  const dayLabel = (day: Temporal.PlainDate, count: number) => {
    const date = format(day, { dateStyle: 'full' })
    return count ? t`${date}: ${plural(count, { one: '# event', other: '# events' })}` : date
  }

  const monthName = capitalize(format(selected, { month: 'long' }))
  const year = String(selected.year)
  const months = Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: capitalize(format(selected.with({ month: index + 1, day: 1 }), { month: 'long' })),
  }))
  const years = Array.from(
    { length: 2 * yearsAround + 1 },
    (_, index) => selected.year - yearsAround + index,
  ).map((value) => ({ value: String(value), label: String(value) }))

  const rows = eventsOn(events.data ?? [], selected)

  return (
    <>
      <main className="mx-auto flex h-dvh max-w-md flex-col">
        <h1 className="sr-only">Capibara Calendar</h1>
        <p role="status" className="sr-only">
          {events.isSuccess && <Trans>Connected to the CalDAV server</Trans>}
        </p>

        <div className="flex flex-wrap items-baseline gap-x-3 px-4 pt-2 pb-1 text-lg">
          <span className="relative inline-block w-[2ch] text-right font-semibold tabular-nums">
            {selected.day}
            <Input
              type="date"
              aria-label={t`Choose a date`}
              value={selected.toString()}
              onChange={(event) => {
                if (event.target.value) setSelected(Temporal.PlainDate.from(event.target.value))
              }}
              onClick={openPicker}
              className="absolute inset-0 h-full w-full opacity-0"
            />
          </span>
          <TextSelect
            label={t`Month: ${monthName}`}
            items={months}
            value={String(selected.month)}
            onChange={(month) => {
              setSelected(selected.with({ month: Number(month) }))
            }}
          />
          <TextSelect
            label={t`Year: ${year}`}
            items={years}
            value={year}
            onChange={(chosen) => {
              setSelected(selected.with({ year: Number(chosen) }))
            }}
          />
          <Button
            variant="link"
            className="ml-auto h-auto p-0 text-base dark:text-sidebar-primary"
            onClick={() => {
              setSelected(Temporal.Now.plainDateISO(timeZone))
            }}
          >
            <Trans>Today</Trans>
          </Button>
        </div>

        <div
          role="group"
          aria-label={t`Week`}
          className="grid grid-cols-7 border-b px-2 pt-1.5 pb-2"
        >
          {weekDays(selected, activeWeekStart()).map((day) => {
            const count = eventsOn(events.data ?? [], day).length
            const isSelected = day.equals(selected)
            const isToday = day.equals(today)
            return (
              <Button
                key={day.toString()}
                variant="ghost"
                className="h-auto min-h-19 flex-col gap-0.5 px-0 pt-1"
                aria-pressed={isSelected}
                aria-current={isToday ? 'date' : undefined}
                onClick={() => {
                  setSelected(day)
                }}
              >
                <span className="sr-only">{dayLabel(day, count)}</span>
                <span aria-hidden="true" className="text-xs font-normal text-muted-foreground">
                  {capitalize(format(day, { weekday: 'short' }))}
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'flex size-9 items-center justify-center rounded-full border-[1.5px] border-transparent text-base',
                    isToday && 'border-primary font-bold',
                    isSelected && 'bg-primary font-bold text-primary-foreground',
                  )}
                >
                  {day.day}
                </span>
                <Badge
                  aria-hidden="true"
                  className={cn(
                    'mt-0.5 h-4 min-w-5 px-1 text-[10px] font-bold',
                    !count && 'invisible',
                  )}
                >
                  {count > 99 ? '99+' : count}
                </Badge>
              </Button>
            )
          })}
        </div>

        <section className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pt-2 pb-16">
          {events.isError && (
            <p className="py-6 text-sm text-destructive">
              <Trans>Cannot reach the CalDAV server</Trans>
            </p>
          )}
          {rows.map(({ event, start, end }) => (
            <Button
              key={event.url}
              variant="ghost"
              className="h-auto w-full shrink-0 justify-start gap-3 rounded-md bg-muted/50 px-3 py-2.5 text-left font-normal whitespace-normal hover:bg-muted/70"
              onClick={() => {
                onEdit(event)
              }}
            >
              <span
                className={cn(
                  'flex shrink-0 flex-col text-[13px] leading-snug tabular-nums',
                  usesTwelveHours(i18n.locale) ? 'w-[4.5rem]' : 'w-12',
                )}
              >
                {start && <span className="font-semibold">{formatTime(start, i18n.locale)}</span>}
                {end && <span className="text-foreground/70">{formatTime(end, i18n.locale)}</span>}
              </span>
              <span className="min-w-0 text-[15px] font-semibold break-words">{event.title}</span>
            </Button>
          ))}
          {events.isSuccess && !rows.length && (
            <p className="py-6 text-sm text-muted-foreground">
              <Trans>Nothing planned</Trans>
            </p>
          )}
        </section>
      </main>

      <BottomBar>
        <Button
          variant="ghost"
          className="size-11 text-secondary-foreground"
          aria-label={t`Settings`}
          onClick={onOpenSettings}
        >
          <Settings className="size-6" />
        </Button>
        <Button
          variant="ghost"
          className="ml-auto size-11 text-primary dark:text-sidebar-primary"
          aria-label={t`New event`}
          onClick={() => {
            onCreate(selected.toString())
          }}
        >
          <Plus className="size-6" />
        </Button>
      </BottomBar>
    </>
  )
}
