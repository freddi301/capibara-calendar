import { useLingui } from '@lingui/react/macro'
import { Crosshair } from 'lucide-react'
import { useState } from 'react'
import type { Coordinates } from '@/api/calendar-api'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { buttonVariants } from '@/components/ui/button'
import { formatCoordinates, geoLink } from '@/lib/coordinates'
import { coordinatesInput } from '@/lib/input-attributes'
import { cn } from 'cn'

const buttonClass = (isPopulated: boolean) =>
  cn(
    buttonVariants({ variant: 'ghost', size: 'icon' }),
    isPopulated &&
      'bg-primary/10 text-primary hover:bg-primary/20 hover:text-primary dark:bg-sidebar-primary/20 dark:text-sidebar-primary dark:hover:bg-sidebar-primary/30',
  )

export function CoordinatesLink({ coordinates }: { coordinates?: Coordinates }) {
  const { t } = useLingui()
  if (!coordinates) {
    return (
      <button type="button" disabled aria-label={t`No coordinates`} className={buttonClass(false)}>
        <Crosshair />
      </button>
    )
  }
  return (
    <a
      href={geoLink(coordinates)}
      aria-label={t`Open the coordinates in the maps app`}
      title={formatCoordinates(coordinates)}
      className={buttonClass(true)}
    >
      <Crosshair />
    </a>
  )
}

export function CoordinatesField({
  value,
  onChange,
  isInvalid,
}: {
  value: string
  onChange: (value: string) => void
  isInvalid: boolean
}) {
  const { t } = useLingui()
  const [isOpen, setIsOpen] = useState(false)
  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger
        aria-label={t`Coordinates`}
        className={cn(buttonClass(!!value.trim()), isInvalid && 'ring-3 ring-destructive/30')}
      >
        <Crosshair />
      </PopoverTrigger>
      <PopoverContent align="end">
        <Input
          aria-label={t`Coordinates`}
          aria-invalid={isInvalid}
          placeholder={t`Latitude, longitude`}
          {...coordinatesInput}
          value={value}
          onChange={(event) => {
            onChange(event.target.value)
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            setIsOpen(false)
          }}
        />
      </PopoverContent>
    </Popover>
  )
}
