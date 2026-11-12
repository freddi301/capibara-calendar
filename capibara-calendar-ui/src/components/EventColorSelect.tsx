import { useLingui } from '@lingui/react/macro'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { palette } from '@/lib/calendar-color'

type EventColorSelectProps = {
  value: string
  onChange: (color: string) => void
}

function Swatch({ color }: { color: string }) {
  return (
    <span
      aria-hidden="true"
      className="size-4 shrink-0 rounded-full border border-foreground/20"
      style={{ backgroundColor: color || 'transparent' }}
    />
  )
}

export default function EventColorSelect({ value, onChange }: EventColorSelectProps) {
  const { t, i18n } = useLingui()
  const isKnown = palette.some(({ color }) => color === value.toLowerCase())
  const choices = [
    { value: '', name: t`No color` },
    ...(value && !isKnown ? [{ value, name: value }] : []),
    ...palette.map(({ color, name }) => ({ value: color, name: i18n._(name) })),
  ]
  return (
    <Select
      items={choices.map((choice) => ({
        value: choice.value,
        label: (
          <span className="flex items-center gap-2">
            <Swatch color={choice.value} />
            {choice.name}
          </span>
        ),
      }))}
      value={value}
      onValueChange={(color) => {
        onChange(color ?? '')
      }}
    >
      <SelectTrigger className="w-44 shrink-0" aria-label={t`Event color`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {choices.map((choice) => (
          <SelectItem key={choice.value} value={choice.value} className="min-h-11">
            <Swatch color={choice.value} />
            {choice.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
