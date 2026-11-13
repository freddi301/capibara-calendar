import { Trans, useLingui } from '@lingui/react/macro'
import { useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useCallback, useState, type ReactNode } from 'react'
import BottomBar, { BottomBarTitle } from '@/components/BottomBar'
import SourcesSection from '@/components/SourcesSection'
import DiscardChangesDialog from '@/components/DiscardChangesDialog'
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
import { refreshEvents } from '@/lib/event-chunks'
import { formatDay } from '@/lib/format'
import { usePhonePortrait } from '@/lib/use-phone-portrait'
import { useBackHandler } from '@/lib/overlay-history'
import { useLeaveGuard } from '@/lib/use-leave-guard'
import {
  applySettings,
  loadSettings,
  saveSettings,
  setChoice,
  systemTheme,
  systemWeekStart,
  type Settings,
} from '@/lib/settings'
import { systemChoice, utcZone, zoneOption } from '@/lib/zone-choice'
import ZoneSelect from '@/components/ZoneSelect'

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
        <SelectTrigger className="w-full" aria-label={label}>
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
  isPasswordRejected?: boolean
  onClose?: () => void
  onConnectionChange: (connected: boolean) => void
}

export default function SettingsScreen({
  isPasswordRejected = false,
  onClose,
  onConnectionChange,
}: SettingsScreenProps) {
  const { t, i18n } = useLingui()
  const queryClient = useQueryClient()
  const [settings, setSettings] = useState(loadSettings)
  const [dirtyForms, setDirtyForms] = useState<string[]>([])
  const setConnectionDirty = useCallback((id: string, isDirty: boolean) => {
    setDirtyForms((now) => {
      const rest = now.filter((other) => other !== id)
      return isDirty ? [...rest, id] : rest
    })
  }, [])
  const guard = useLeaveGuard(dirtyForms.length > 0, () => {
    onClose?.()
  })
  useBackHandler(guard.leave)

  const choose = (key: keyof Settings) => (choice: string) => {
    const next = setChoice(settings, key, choice)
    setSettings(next)
    saveSettings(next)
    void applySettings(next)
    if (key === 'timeZone') void refreshEvents(queryClient)
  }

  const systemLanguage = locales[detectLocale()]
  const systemZone = Temporal.Now.timeZoneId()
  const zonePins = [
    zoneOption(systemChoice, { label: t`System`, hint: systemZone, hintInTrigger: true }),
    ...(settings.timeZone ? [zoneOption(settings.timeZone)] : []),
    zoneOption(utcZone, {
      hint: t`Universal time, the same all over the world, with no daylight saving`,
    }),
  ]
  const weekday = (day: number) => {
    const date = Temporal.PlainDate.from({ year: 2024, month: 1, day })
    const name = formatDay(date, i18n.locale, { weekday: 'long' })
    return name.charAt(0).toLocaleUpperCase(i18n.locale) + name.slice(1)
  }
  const systemThemeName = systemTheme() === 'dark' ? t`Dark` : t`Light`
  const systemWeekday = weekday(systemWeekStart())

  const isTitleInBar = !usePhonePortrait() && onClose !== undefined

  return (
    <>
      <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-4 pt-15 pb-4 phone:pt-4 phone:pb-16">
        {!isTitleInBar && (
          <h1 className="text-center text-2xl font-bold text-muted-foreground">
            <Trans>Settings</Trans>
          </h1>
        )}
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
        <FieldSet>
          <FieldLegend variant="label">{t`Time zone`}</FieldLegend>
          <ZoneSelect
            label={t`Time zone`}
            value={settings.timeZone ?? systemChoice}
            pinned={zonePins}
            onChange={choose('timeZone')}
          />
        </FieldSet>
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
        <SourcesSection
          isRejected={isPasswordRejected}
          onConnectionChange={onConnectionChange}
          onDirtyChange={setConnectionDirty}
        />
      </main>

      <DiscardChangesDialog guard={guard} />

      {onClose && (
        <BottomBar>
          <Button
            variant="ghost"
            className="size-11 text-muted-foreground"
            aria-label={t`Back`}
            onClick={guard.leave}
          >
            <ArrowLeft />
          </Button>
          {isTitleInBar && (
            <BottomBarTitle isCentered>
              <Trans>Settings</Trans>
            </BottomBarTitle>
          )}
        </BottomBar>
      )}
    </>
  )
}
