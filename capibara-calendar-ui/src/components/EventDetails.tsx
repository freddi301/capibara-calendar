import { useLingui } from '@lingui/react/macro'
import { Bell, MapPin, Tag, Video, type LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form'
import TagsInput from '@/components/TagsInput'
import { FieldError } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { customReminder, type EventFormValues, type Reminder } from '@/lib/event-schema'
import { linkInput, nameInput } from '@/lib/input-attributes'
import { useReadOnly, useSelectLock } from '@/lib/read-only'

function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden="true" className="flex h-8 items-center justify-center text-muted-foreground">
      <Icon className="size-5" />
    </span>
  )
}

function OneLine(props: ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      readOnly={useReadOnly()}
      rows={1}
      className="min-h-8 resize-none py-1"
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.preventDefault()
      }}
      {...props}
    />
  )
}

type ChoiceRowProps = {
  form: UseFormReturn<EventFormValues>
  name: 'reminder' | 'showAs' | 'visibility'
  label: string
  icon: LucideIcon
  items: { value: string; label: string }[]
}

function ChoiceRow({ form, name, label, icon, items }: ChoiceRowProps) {
  const selectLock = useSelectLock()
  return (
    <>
      <RowIcon icon={icon} />
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Select
            {...selectLock}
            items={items}
            value={field.value ?? items[0].value}
            onValueChange={field.onChange}
          >
            <SelectTrigger className="w-full min-w-0" aria-label={label}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map(({ value, label: text }) => (
                <SelectItem key={value} value={value} className="min-h-11">
                  {text}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      />
    </>
  )
}

export default function EventDetails({ form }: { form: UseFormReturn<EventFormValues> }) {
  const { t } = useLingui()
  const {
    register,
    control,
    formState: { errors },
  } = form
  const reminder = useWatch({ control, name: 'reminder' })

  const reminderItems: { value: Reminder; label: string }[] = [
    { value: '', label: t`No reminder` },
    { value: '0', label: t`At the start` },
    { value: '5', label: t`5 minutes before` },
    { value: '10', label: t`10 minutes before` },
    { value: '15', label: t`15 minutes before` },
    { value: '30', label: t`30 minutes before` },
    { value: '60', label: t`1 hour before` },
    { value: '120', label: t`2 hours before` },
    { value: '1440', label: t`1 day before` },
    { value: '2880', label: t`2 days before` },
    { value: '10080', label: t`1 week before` },
    ...(reminder === customReminder
      ? [{ value: customReminder, label: t`Custom, kept as it is` }]
      : []),
  ]

  return (
    <div className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-3">
      <RowIcon icon={Tag} />
      <Controller
        control={control}
        name="tags"
        render={({ field }) => <TagsInput value={field.value ?? ''} onChange={field.onChange} />}
      />

      <RowIcon icon={Video} />
      <div className="flex min-w-0 flex-col gap-1">
        <OneLine
          {...linkInput}
          aria-label={t`Video call link`}
          aria-invalid={!!errors.videoLink}
          {...register('videoLink')}
        />
        <FieldError errors={[errors.videoLink]} />
      </div>

      <RowIcon icon={MapPin} />
      <OneLine aria-label={t`Location`} {...nameInput} {...register('location')} />

      <ChoiceRow
        form={form}
        name="reminder"
        label={t`Reminder`}
        icon={Bell}
        items={reminderItems}
      />
    </div>
  )
}
