import { Trans, useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import BottomBar from '@/components/BottomBar'
import ConnectionForm from '@/components/ConnectionForm'
import { Button } from '@/components/ui/button'
import { FieldLegend, FieldSet } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { detectLocale, locales } from '@/i18n'
import {
  applySettings,
  loadSettings,
  saveSettings,
  setChoice,
  systemTheme,
  systemWeekStart,
  timeZones,
  type Settings,
} from '@/lib/settings'

type ChoiceSelectProps = {
  label: string
  items: { value: string; label: ReactNode }[]
  value: string
  onChange: (choice: string) => void
}

/** The System option: it says what the system is right now, in secondary text. */
function SystemOption({ value }: { value: string }) {
  return (
    <>
      <Trans>System</Trans> <span className="text-muted-foreground">{value}</span>
    </>
  )
}

/** A labelled select with a few choices. */
function ChoiceSelect({ label, items, value, onChange }: ChoiceSelectProps) {
  return (
    <FieldSet>
      <FieldLegend variant="label">{label}</FieldLegend>
      <Select
        items={items}
        value={value}
        onValueChange={(choice) => {
          if (choice) onChange(choice)
        }}
      >
        <SelectTrigger className="w-full data-[size=default]:h-11" aria-label={label}>
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
    </FieldSet>
  )
}

type SettingsScreenProps = {
  onClose?: () => void
  onConnectionChange: (connected: boolean) => void
}

export default function SettingsScreen({ onClose, onConnectionChange }: SettingsScreenProps) {
  const { t, i18n } = useLingui()
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState(loadSettings)

  const choose = (key: keyof Settings) => (choice: string) => {
    const next = setChoice(settings, key, choice)
    setSettings(next)
    saveSettings(next)
    void applySettings(next)
    if (key === 'timeZone') void queryClient.invalidateQueries({ queryKey: ['events'] })
  }

  const systemLanguage = locales[detectLocale()]
  const systemZone = Temporal.Now.timeZoneId()
  const zones =
    settings.timeZone && !timeZones.includes(settings.timeZone)
      ? [settings.timeZone, ...timeZones]
      : timeZones
  const weekday = (day: number) => {
    const date = Temporal.PlainDate.from({ year: 2024, month: 1, day })
    const name = date.toLocaleString(i18n.locale, { weekday: 'long' })
    return name.charAt(0).toLocaleUpperCase(i18n.locale) + name.slice(1)
  }
  const systemThemeName = systemTheme() === 'dark' ? t`Dark` : t`Light`
  const systemWeekday = weekday(systemWeekStart())

  return (
    <>
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-4 pb-16">
        <h1 className="text-2xl font-bold text-muted-foreground">
          <Trans>Settings</Trans>
        </h1>
        <ConnectionForm onConnectionChange={onConnectionChange} />
        <ChoiceSelect
          label={t`Language`}
          items={[
            { value: 'system', label: <SystemOption value={systemLanguage} /> },
            { value: 'en', label: locales.en },
            { value: 'it', label: locales.it },
          ]}
          value={settings.language ?? 'system'}
          onChange={choose('language')}
        />
        <ChoiceSelect
          label={t`Theme`}
          items={[
            { value: 'system', label: <SystemOption value={systemThemeName} /> },
            { value: 'dark', label: t`Dark` },
            { value: 'light', label: t`Light` },
          ]}
          value={settings.theme ?? 'system'}
          onChange={choose('theme')}
        />
        <ChoiceSelect
          label={t`Time zone`}
          items={[
            { value: 'system', label: <SystemOption value={systemZone} /> },
            ...zones.map((zone) => ({ value: zone, label: zone })),
          ]}
          value={settings.timeZone ?? 'system'}
          onChange={choose('timeZone')}
        />
        <ChoiceSelect
          label={t`First day of the week`}
          items={[
            { value: 'system', label: <SystemOption value={systemWeekday} /> },
            { value: 'monday', label: weekday(1) },
            { value: 'saturday', label: weekday(6) },
            { value: 'sunday', label: weekday(7) },
          ]}
          value={settings.weekStart ?? 'system'}
          onChange={choose('weekStart')}
        />
      </main>

      {onClose && (
        <BottomBar>
          <Button
            variant="ghost"
            className="size-11 text-muted-foreground"
            aria-label={t`Back`}
            onClick={onClose}
          >
            <ArrowLeft />
          </Button>
        </BottomBar>
      )}
    </>
  )
}
