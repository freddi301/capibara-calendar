import { useLingui } from '@lingui/react/macro'
import { Globe } from 'lucide-react'
import { RowIcon } from '@/components/EventDetails'
import ZoneSelect from '@/components/ZoneSelect'
import { floatingChoice, utcZone, zoneOption } from '@/lib/zone-choice'

type TimeZoneRowProps = {
  value: string
  appZone: string
  onChange: (zone: string) => void
}

export default function TimeZoneRow({ value, appZone, onChange }: TimeZoneRowProps) {
  const { t } = useLingui()
  const app = zoneOption(appZone)
  const utc = zoneOption(utcZone, {
    hint: t`Universal time, the same all over the world, with no daylight saving`,
  })
  const floating = zoneOption(floatingChoice, {
    label: t`Floating`,
    hint: t`The same time wherever you are`,
  })
  const current = [app, utc, floating].find((option) => option.value === (value || floatingChoice))
  return (
    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-3">
      <RowIcon icon={Globe} />
      <div className="min-w-0">
        <ZoneSelect
          label={t`Time zone`}
          value={value || floatingChoice}
          pinned={[app, current ?? zoneOption(value), utc, floating]}
          onChange={(zone) => onChange(zone === floatingChoice ? '' : zone)}
        />
      </div>
    </div>
  )
}
