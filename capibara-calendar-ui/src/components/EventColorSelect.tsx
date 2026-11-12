import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { Check } from 'lucide-react'
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

/** A color as a round swatch, with a check on it when it is the chosen one; no color is a dashed circle. */
function Swatch({ color, isChosen = false }: { color: string; isChosen?: boolean }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex size-5 shrink-0 items-center justify-center rounded-full',
        color
          ? 'border border-foreground/20 text-white'
          : 'border-2 border-dashed border-foreground/40 text-foreground',
      )}
      style={color ? { backgroundColor: color } : undefined}
    >
      {isChosen && <Check className="size-3.5" />}
    </span>
  )
}

/** The color of one event: none, which is the color of its calendar, or one of the palette. */
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
        label: <Swatch color={choice.value} />,
      }))}
      value={value}
      onValueChange={(color) => {
        onChange(color ?? '')
      }}
    >
      <SelectTrigger
        className="w-auto shrink-0 gap-0 px-2.5 [&>svg]:hidden"
        aria-label={t`Event color`}
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="w-auto! min-w-0!">
        {choices.map((choice) => (
          <SelectItem
            key={choice.value}
            value={choice.value}
            aria-label={choice.name}
            hasIndicator={false}
            className="min-h-11 justify-center px-3"
          >
            <Swatch color={choice.value} isChosen={choice.value === value} />
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
