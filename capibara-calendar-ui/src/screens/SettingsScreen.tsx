import { Trans, useLingui } from '@lingui/react/macro'
import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import BottomBar from '@/components/BottomBar'
import { Button } from '@/components/ui/button'
import { FieldLegend, FieldSet } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { locales } from '@/i18n'
import { applySettings, loadSettings, saveSettings, setChoice, type Settings } from '@/lib/settings'

type ChoiceSelectProps = {
  label: string
  items: { value: string; label: string }[]
  value: string
  onChange: (choice: string) => void
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

export default function SettingsScreen({ onClose }: { onClose: () => void }) {
  const { t } = useLingui()
  const [settings, setSettings] = useState(loadSettings)

  const choose = (key: keyof Settings) => (choice: string) => {
    const next = setChoice(settings, key, choice)
    setSettings(next)
    saveSettings(next)
    void applySettings(next)
  }

  return (
    <>
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-4 pb-16">
        <h1 className="text-2xl font-bold text-muted-foreground">
          <Trans>Settings</Trans>
        </h1>
        <ChoiceSelect
          label={t`Language`}
          items={[
            { value: 'system', label: t`System` },
            { value: 'en', label: locales.en },
            { value: 'it', label: locales.it },
          ]}
          value={settings.language ?? 'system'}
          onChange={choose('language')}
        />
        <ChoiceSelect
          label={t`Theme`}
          items={[
            { value: 'system', label: t`System` },
            { value: 'dark', label: t`Dark` },
            { value: 'light', label: t`Light` },
          ]}
          value={settings.theme ?? 'system'}
          onChange={choose('theme')}
        />
      </main>

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
    </>
  )
}
