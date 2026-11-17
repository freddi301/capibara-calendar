import { useLingui } from '@lingui/react/macro'
import ZoneSelect from '@/components/ZoneSelect'
import { capitalize, formatDay, formatTime } from '@/lib/format'
import { floatingChoice, utcZone, zoneName, zoneOption, type ZoneTime } from '@/lib/zone-choice'

type RowZoneProps = {
  label: string
  value: string
  appZone: string
  isFloatingAllowed: boolean
  isDisabled?: boolean
  inAppZone?: ZoneTime
  onChange: (zone: string) => void
}

export default function RowZone({
  label,
  value,
  appZone,
  isFloatingAllowed,
  isDisabled,
  inAppZone,
  onChange,
}: RowZoneProps) {
  const { t } = useLingui()
  const app = zoneOption(appZone)
  const utc = zoneOption(utcZone, {
    hint: t`Universal time, the same all over the world, with no daylight saving`,
  })
  const floating = zoneOption(floatingChoice, {
    label: t`Floating`,
    hint: t`The same time wherever you are`,
  })
  const own = [app, utc, floating].find((option) => option.value === (value || floatingChoice))
  return (
    <div className="col-span-full -mt-1 flex items-center gap-3">
      <AppZoneText time={inAppZone} appZone={appZone} />
      <div className="ml-auto w-44 shrink-0">
        <ZoneSelect
          label={label}
          value={value || floatingChoice}
          pinned={[app, own ?? zoneOption(value), utc, ...(isFloatingAllowed ? [floating] : [])]}
          onChange={(zone) => {
            onChange(zone === floatingChoice ? '' : zone)
          }}
          isDisabled={isDisabled}
        />
      </div>
    </div>
  )
}

function AppZoneText({ time, appZone }: { time?: ZoneTime; appZone: string }) {
  const { i18n } = useLingui()
  if (!time) return null
  const { locale } = i18n
  const day = capitalize(
    formatDay(Temporal.PlainDate.from(time.date), locale, {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
    }),
    locale,
  )
  return (
    <p className="min-w-0 text-sm text-muted-foreground tabular-nums">
      {time.isOtherDay && <span className="mr-1.5">{day}</span>}
      {formatTime(time.time, locale)} {zoneName(appZone)}
    </p>
  )
}
