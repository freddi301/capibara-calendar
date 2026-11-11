import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { capitalize } from '@/lib/format'
import { openPicker } from '@/lib/picker'

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
      <SelectContent className="min-w-44 p-1.5">
        {items.map((item) => (
          <SelectItem key={item.value} value={item.value} className="min-h-11 pr-10 pl-4">
            {item.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

const yearsAround = 10

type DateLineProps = {
  isSpaced?: boolean
  isBordered?: boolean
  selected: Temporal.PlainDate
  today: Temporal.PlainDate
  onSelect: (day: Temporal.PlainDate) => void
}

export default function DateLine({
  isSpaced = false,
  isBordered = false,
  selected,
  today,
  onSelect,
}: DateLineProps) {
  const { t, i18n } = useLingui()
  const format = (date: Temporal.PlainDate, options: Intl.DateTimeFormatOptions) =>
    date.toLocaleString(i18n.locale, options)
  const monthName = capitalize(format(selected, { month: 'long' }), i18n.locale)
  const year = String(selected.year)
  const months = Array.from({ length: 12 }, (_, index) => ({
    value: String(index + 1),
    label: capitalize(
      format(selected.with({ month: index + 1, day: 1 }), { month: 'long' }),
      i18n.locale,
    ),
  }))
  const years = Array.from(
    { length: 2 * yearsAround + 1 },
    (_, index) => selected.year - yearsAround + index,
  ).map((value) => ({ value: String(value), label: String(value) }))

  return (
    <div
      className={cn(
        'flex flex-wrap items-baseline gap-x-3 px-4 pt-2 text-lg',
        isSpaced ? 'pb-2' : 'pb-1',
        isBordered && 'border-b',
      )}
    >
      <span className="relative inline-block w-[2ch] text-right font-semibold tabular-nums">
        {selected.day}
        <Input
          type="date"
          aria-label={t`Choose a date`}
          value={selected.toString()}
          onChange={(event) => {
            if (event.target.value) onSelect(Temporal.PlainDate.from(event.target.value))
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
          onSelect(selected.with({ month: Number(month) }))
        }}
      />
      <TextSelect
        label={t`Year: ${year}`}
        items={years}
        value={year}
        onChange={(chosen) => {
          onSelect(selected.with({ year: Number(chosen) }))
        }}
      />
      <Button
        variant="link"
        className="ml-auto h-auto p-0 text-base dark:text-sidebar-primary"
        onClick={() => {
          onSelect(today)
        }}
      >
        <Trans>Today</Trans>
      </Button>
    </div>
  )
}
