import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import SourceIcon from '@/components/SourceIcon'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { colorBorder, colorMark } from '@/lib/calendar-color'
import { groupBySource, type CalendarInfo } from '@/lib/calendars'

type CalendarPickerProps = {
  calendars: CalendarInfo[]
  value: string | undefined
  onChange: (url: string) => void
}

export default function CalendarPicker({ calendars, value, onChange }: CalendarPickerProps) {
  const { t } = useLingui()
  const chosen = calendars.find(({ url }) => url === value)
  return (
    <Select
      items={calendars.map(({ url, name }) => ({ value: url, label: name }))}
      value={value ?? null}
      onValueChange={(next) => {
        if (next) onChange(next)
      }}
    >
      <SelectTrigger
        {...colorMark}
        className={cn('w-full', chosen?.color && 'border-r-4')}
        style={colorBorder(chosen?.color)}
        aria-label={t`Calendar`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {groupBySource(calendars).map((group) => (
          <SelectGroup key={group.sourceId}>
            <SelectLabel className="flex min-h-11 items-center gap-2 px-3 text-sm">
              <span className="min-w-0 flex-1 truncate">{group.name}</span>
              <SourceIcon kind={group.kind} />
            </SelectLabel>
            {group.calendars.map((one) => (
              <SelectItem
                key={one.url}
                value={one.url}
                {...colorMark}
                className={cn('min-h-11', one.color && 'border-r-4')}
                style={colorBorder(one.color)}
              >
                {one.name}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  )
}
