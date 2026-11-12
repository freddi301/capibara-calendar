import { useLingui } from '@lingui/react/macro'
import { Globe } from 'lucide-react'
import { RowIcon } from '@/components/EventDetails'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { timeZones } from '@/lib/settings'
import { floatingChoice, zoneHint } from '@/lib/zone-choice'

type TimeZoneRowProps = {
  value: string
  appZone: string
  startDate: string
  startTime: string
  onChange: (zone: string) => void
}

export default function TimeZoneRow({
  value,
  appZone,
  startDate,
  startTime,
  onChange,
}: TimeZoneRowProps) {
  const { t } = useLingui()
  const zones = [appZone, ...timeZones.filter((zone) => zone !== appZone)]
  const items = [
    ...zones.map((zone) => ({ value: zone, label: zone })),
    { value: floatingChoice, label: t`Floating, the same wherever you are` },
  ]
  const hint = zoneHint(value, appZone, startDate, startTime)
  return (
    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1">
      <RowIcon icon={Globe} />
      <div className="flex min-w-0 flex-col gap-1">
        <Select
          items={items}
          value={value || floatingChoice}
          onValueChange={(choice) => {
            if (choice) onChange(choice === floatingChoice ? '' : choice)
          }}
        >
          <SelectTrigger className="w-full min-w-0" aria-label={t`Time zone`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value} className="min-h-11">
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hint && <p className="text-sm text-muted-foreground">{t`In your time zone: ${hint}`}</p>}
      </div>
    </div>
  )
}
