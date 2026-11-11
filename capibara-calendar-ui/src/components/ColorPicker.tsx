import { Trans, useLingui } from '@lingui/react/macro'
import { Check } from 'lucide-react'
import { FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { palette } from '@/lib/calendar-color'

type ColorPickerProps = {
  value: string
  onChange: (color: string) => void
}

export default function ColorPicker({ value, onChange }: ColorPickerProps) {
  const { t, i18n } = useLingui()
  return (
    <FieldSet>
      <FieldLegend variant="label">
        <Trans>Color</Trans>
      </FieldLegend>
      <label className="flex items-center gap-3">
        <Input
          type="color"
          aria-label={t`Custom color`}
          value={value}
          className="h-10 w-16 p-1"
          onChange={(event) => {
            onChange(event.target.value)
          }}
        />
        <span className="text-sm text-muted-foreground tabular-nums">{value}</span>
      </label>
      <div className="flex flex-wrap gap-3">
        {palette.map(({ color, name }) => {
          const isChosen = value.toLowerCase() === color
          return (
            <button
              key={color}
              type="button"
              aria-label={i18n._(name)}
              aria-pressed={isChosen}
              className="flex size-10 items-center justify-center rounded-full text-white outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              style={{ backgroundColor: color }}
              onClick={() => {
                onChange(color)
              }}
            >
              {isChosen && <Check className="size-5" aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    </FieldSet>
  )
}
