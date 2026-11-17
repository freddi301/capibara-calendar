import { useLingui } from '@lingui/react/macro'
import { useState, type ReactNode } from 'react'
import Rolling from '@/components/Rolling'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { capitalize, formatDay, longestWeekday, pickerOverName } from '@/lib/format'
import { openPicker } from '@/lib/picker'

type TextSelectProps = {
  label: string
  items: { value: string; label: string }[]
  value: string
  chars: number
  isForward: boolean
  onChange: (value: string) => void
}

function TextSelect({ label, items, value, chars, isForward, onChange }: TextSelectProps) {
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
        style={{ minWidth: `${chars}ch` }}
        className="h-11 w-fit justify-start gap-0 border-0 bg-transparent p-0 text-lg font-semibold shadow-none data-[size=default]:h-11 dark:bg-transparent dark:hover:bg-transparent [&_svg]:hidden"
      >
        <SelectValue>
          <Rolling
            text={items.find((item) => item.value === value)?.label ?? value}
            isForward={isForward}
          />
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="min-w-44 p-0">
        {items.map((item) => (
          <SelectItem
            key={item.value}
            value={item.value}
            className="min-h-11 rounded-none pr-10 pl-4"
          >
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const yearsAround = 10

type CurrentDateProps = {
  selected: Temporal.PlainDate
  leading?: ReactNode
  previous?: ReactNode
  onSelect: (day: Temporal.PlainDate) => void
}

export default function CurrentDate({ selected, leading, previous, onSelect }: CurrentDateProps) {
  const { t, i18n } = useLingui()
  const [move, setMove] = useState({ date: selected, isForward: true })
  if (!move.date.equals(selected)) {
    setMove({ date: selected, isForward: Temporal.PlainDate.compare(selected, move.date) > 0 })
  }
  const format = (date: Temporal.PlainDate, options: Intl.DateTimeFormatOptions) =>
    capitalize(formatDay(date, i18n.locale, options), i18n.locale)
  const weekday = format(selected, { weekday: 'long' })
  const weekdayChars = longestWeekday(i18n.locale)
  const monthName = format(selected, { month: 'long' })
  const year = String(selected.year)
  const months = Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: format(selected.with({ month: index + 1, day: 1 }), { month: 'long' }),
  }))
  const years = Array.from(
    { length: 2 * yearsAround + 1 },
    (_, index) => selected.year - yearsAround + index,
  ).map((value) => ({ value: String(value), label: String(value) }))

  return (
    <>
      <div className="flex h-11 items-center gap-x-1 text-lg">
        {leading}
        <div className="ml-auto flex items-center gap-x-1">
          {previous}
          <span
            className="inline-block text-right text-muted-foreground"
            style={{ minWidth: `${weekdayChars}ch` }}
          >
            <Rolling text={weekday} isForward={move.isForward} />
          </span>
        </div>
      </div>
      <div className="relative flex h-11 items-center gap-x-3 text-lg">
        <span className="inline-block w-[2ch] text-right font-semibold tabular-nums">
          <Rolling text={String(selected.day)} isForward={move.isForward} />
        </span>
        <Input
          type="date"
          aria-label={t`Choose a date`}
          value={selected.toString()}
          onChange={(event) => {
            if (event.target.value) onSelect(Temporal.PlainDate.from(event.target.value))
          }}
          onClick={openPicker}
          style={pickerOverName(weekdayChars)}
          className="absolute inset-y-0 h-full opacity-0"
        />
        <TextSelect
          label={t`Month: ${monthName}`}
          items={months}
          chars={Math.max(...months.map(({ label }) => label.length))}
          isForward={move.isForward}
          value={String(selected.month)}
          onChange={(month) => {
            onSelect(selected.with({ month: Number(month) }))
          }}
        />
        <TextSelect
          label={t`Year: ${year}`}
          items={years}
          chars={year.length}
          isForward={move.isForward}
          value={year}
          onChange={(chosen) => {
            onSelect(selected.with({ year: Number(chosen) }))
          }}
        />
      </div>
    </>
  )
}
