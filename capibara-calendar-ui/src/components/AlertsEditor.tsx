import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useLingui } from '@lingui/react/macro'
import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { alertChoices } from '@/lib/event-form'
import { customReminderLabel, reminderLabels } from '@/lib/reminder-labels'

type AlertsEditorProps = {
  value: string[]
  hasCustom: boolean
  onChange: (alerts: string[]) => void
}

const firstChoice = '15'

export default function AlertsEditor({ value, hasCustom, onChange }: AlertsEditorProps) {
  const { t, i18n } = useLingui()
  const items = alertChoices.map((choice) => ({
    value: choice,
    label: i18n._(reminderLabels[choice as keyof typeof reminderLabels]),
  }))
  const [listRef] = useAutoAnimate()
  return (
    <div ref={listRef} className="flex min-w-0 flex-col gap-2">
      {value.map((minutes, index) => {
        const number = index + 1
        return (
          <div key={index} className="flex items-center gap-1">
            <Select
              items={items}
              value={minutes}
              onValueChange={(choice) => {
                if (choice) onChange(value.map((current, at) => (at === index ? choice : current)))
              }}
            >
              <SelectTrigger className="w-full min-w-0" aria-label={t`Alert ${number}`}>
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
            <Button
              type="button"
              variant="ghost"
              className="size-8 shrink-0 text-muted-foreground"
              aria-label={t`Remove alert ${number}`}
              onClick={() => {
                onChange(value.filter((_, at) => at !== index))
              }}
            >
              <X className="size-4" />
            </Button>
          </div>
        )
      })}
      {hasCustom && <p className="text-sm text-muted-foreground">{i18n._(customReminderLabel)}</p>}
      <Button
        type="button"
        variant="ghost"
        className="h-8 w-fit gap-1 px-2 text-muted-foreground"
        onClick={() => {
          onChange([...value, firstChoice])
        }}
      >
        <Plus className="size-4" />
        {t`Add alert`}
      </Button>
    </div>
  )
}
