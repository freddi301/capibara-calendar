import { useState } from 'react'
import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { Check, Pipette } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { palette } from '@/lib/calendar-color'
import { rememberColor } from '@/lib/recent-colors'
import { useStored } from '@/lib/use-stored'

type ColorSelectProps = {
  value: string
  onChange: (color: string) => void
  label: string
}

const isCustomColor = (color: string) =>
  !!color && !palette.some((item) => item.color === color.toLowerCase())

const buttonClass = cn('rounded-full outline-none focus-visible:ring-3 focus-visible:ring-ring/50')

function Swatch({
  color,
  isChosen = false,
  className,
}: {
  color: string
  isChosen?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex shrink-0 items-center justify-center rounded-full',
        color
          ? 'border border-foreground/20 text-white'
          : 'border-2 border-dashed border-foreground/40 text-foreground',
        className,
      )}
      style={color ? { backgroundColor: color } : undefined}
    >
      {isChosen && <Check className="size-5" />}
    </span>
  )
}

export default function ColorSelect({ value, onChange, label }: ColorSelectProps) {
  const { t, i18n } = useLingui()
  const [isOpen, setIsOpen] = useState(false)
  const recent = useStored((stored) => stored.recentColors)
  const isCustom = isCustomColor(value)

  const remember = (color: string) => {
    if (isCustomColor(color)) rememberColor(color)
  }
  const choose = (color: string) => {
    onChange(color)
    remember(color)
    setIsOpen(false)
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) remember(value) // the one that was picked with the color picker of the system
        setIsOpen(open)
      }}
    >
      <PopoverTrigger
        aria-label={label}
        className={cn(
          'flex h-8 shrink-0 items-center rounded-lg border border-input bg-muted px-2.5 text-sm transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30 dark:hover:bg-input/50',
        )}
      >
        <Swatch color={value} className="size-5" />
      </PopoverTrigger>
      <PopoverContent className="w-auto">
        <div className="flex gap-2">
          <button
            type="button"
            aria-label={t`No color`}
            aria-pressed={!value}
            className={buttonClass}
            onClick={() => {
              choose('')
            }}
          >
            <Swatch color="" isChosen={!value} className="size-9" />
          </button>
          <label
            className={cn(
              'relative flex size-9 shrink-0 cursor-pointer rounded-full bg-[conic-gradient(red,yellow,lime,aqua,blue,magenta,red)] p-1 focus-within:ring-3 focus-within:ring-ring/50',
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                'flex size-full items-center justify-center rounded-full',
                isCustom ? 'text-white' : 'bg-popover text-foreground',
              )}
              style={isCustom ? { backgroundColor: value } : undefined}
            >
              {isCustom ? <Check className="size-4" /> : <Pipette className="size-4" />}
            </span>
            <input
              type="color"
              aria-label={t`Custom color`}
              value={value || palette[0].color}
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              onChange={(event) => {
                onChange(event.target.value)
              }}
            />
          </label>
          {recent.map((color) => {
            const isChosen = value.toLowerCase() === color
            return (
              <button
                key={color}
                type="button"
                aria-label={color}
                aria-pressed={isChosen}
                className={buttonClass}
                onClick={() => {
                  choose(color)
                }}
              >
                <Swatch color={color} isChosen={isChosen} className="size-9" />
              </button>
            )
          })}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {palette.map(({ color, name }) => {
            const isChosen = value.toLowerCase() === color
            return (
              <button
                key={color}
                type="button"
                aria-label={i18n._(name)}
                aria-pressed={isChosen}
                className={buttonClass}
                onClick={() => {
                  choose(color)
                }}
              >
                <Swatch color={color} isChosen={isChosen} className="size-9" />
              </button>
            )
          })}
        </div>
      </PopoverContent>
    </Popover>
  )
}
