import { cn } from 'cn'
import { useLingui } from '@lingui/react/macro'
import { CalendarCheck, CalendarOff } from 'lucide-react'
import type { EventAvailability } from '@/api/calendar-api'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { availabilityHints, availabilityLabels } from '@/lib/availability-labels'
import { availabilities } from '@/lib/event-schema'

export function AvailabilityIcon({
  availability,
  className,
}: {
  availability: EventAvailability
  className?: string
}) {
  const Icon = availability === 'free' ? CalendarOff : CalendarCheck
  return (
    <Icon aria-hidden="true" className={cn('size-4 shrink-0 text-muted-foreground', className)} />
  )
}

export default function AvailabilitySelect({
  value,
  onChange,
}: {
  value: EventAvailability
  onChange: (value: EventAvailability) => void
}) {
  const { t, i18n } = useLingui()
  return (
    <Select
      items={availabilities.map((one) => ({
        value: one,
        label: (
          <span className="flex items-center gap-2">
            <AvailabilityIcon availability={one} />
            {i18n._(availabilityLabels[one])}
          </span>
        ),
      }))}
      value={value}
      onValueChange={(next) => {
        if (next) onChange(next)
      }}
    >
      <SelectTrigger className="w-full min-w-0" aria-label={t`Show as`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="min-w-72">
        {availabilities.map((one) => (
          <SelectItem key={one} value={one} className="items-start gap-3 py-2.5 pr-9 pl-3">
            <AvailabilityIcon availability={one} className="mt-0.5" />
            <span className="flex flex-col gap-0.5 whitespace-normal">
              <span className="leading-5 font-medium">{i18n._(availabilityLabels[one])}</span>
              <span className="text-sm leading-snug font-normal text-muted-foreground!">
                {i18n._(availabilityHints[one])}
              </span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
