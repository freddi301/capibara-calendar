import { useLingui } from '@lingui/react/macro'
import { Bell, MapPin, Tag, Video, type LucideIcon } from 'lucide-react'
import type { ComponentProps } from 'react'
import { Controller, type UseFormReturn } from 'react-hook-form'
import AlertsEditor from '@/components/AlertsEditor'
import TagsInput from '@/components/TagsInput'
import { FieldError } from '@/components/ui/field'
import { Textarea } from '@/components/ui/textarea'
import type { EventFormValues } from '@/lib/event-schema'
import { linkInput, nameInput } from '@/lib/input-attributes'

export function RowIcon({ icon: Icon }: { icon: LucideIcon }) {
  return (
    <span aria-hidden="true" className="flex h-8 items-center justify-center text-muted-foreground">
      <Icon className="size-5" />
    </span>
  )
}

function OneLine(props: ComponentProps<typeof Textarea>) {
  return (
    <Textarea
      rows={1}
      className="min-h-8 resize-none py-1"
      onKeyDown={(event) => {
        if (event.key === 'Enter') event.preventDefault()
      }}
      {...props}
    />
  )
}

export default function EventDetails({
  form,
  hasCustomAlerts,
}: {
  form: UseFormReturn<EventFormValues>
  hasCustomAlerts: boolean
}) {
  const { t } = useLingui()
  const {
    register,
    control,
    formState: { errors },
  } = form
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

      <RowIcon icon={Bell} />
      <Controller
        control={control}
        name="alerts"
        render={({ field }) => (
          <AlertsEditor
            value={field.value ?? []}
            hasCustom={hasCustomAlerts}
            onChange={field.onChange}
          />
        )}
      />
    </div>
  )
}
