import { zodResolver } from '@hookform/resolvers/zod'
import { Trans } from '@lingui/react/macro'
import { useMutation } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { useId, useState } from 'react'
import { useForm } from 'react-hook-form'
import { checkWebcal } from '@/api/sources'
import { feedUrl } from '@/api/webcal/feed'
import Problem from '@/components/Problem'
import SourceCard, { AddSourceButton } from '@/components/SourceCard'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { webcalErrorMessage } from '@/lib/errors'
import { feedInput, nameInput } from '@/lib/input-attributes'
import {
  addWebcal,
  createWebcalSchema,
  nameOfFeed,
  presetWebcal,
  type WebcalValues,
} from '@/lib/webcal'

const urlField: keyof WebcalValues = 'url'

const empty: WebcalValues = { url: presetWebcal, name: '' }

type WebcalFormProps = { onChange: () => void }

/** The button that adds a webcal, and the card with the form that it opens. */
export default function WebcalForm({ onChange }: WebcalFormProps) {
  const id = useId()
  const [isAdding, setAdding] = useState(false)
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<WebcalValues>({
    resolver: zodResolver(createWebcalSchema()),
    defaultValues: empty,
  })

  const add = useMutation({
    meta: { isTrial: true },
    mutationFn: async (values: WebcalValues) => {
      const url = feedUrl(values.url) ?? values.url
      const feed = await checkWebcal(url)
      addWebcal({
        url,
        name: values.name || feed.name || nameOfFeed(url),
        ...(feed.color ? { color: feed.color } : {}),
      })
    },
    onSuccess: () => {
      reset(empty)
      setAdding(false)
      onChange()
    },
  })

  if (!isAdding) {
    return (
      <AddSourceButton
        onClick={() => {
          setAdding(true)
        }}
      >
        <Trans>Add Webcal</Trans>
      </AddSourceButton>
    )
  }

  return (
    <SourceCard kind="webcal" title={<Trans>Webcal</Trans>}>
      <form
        noValidate
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          void handleSubmit((values) => {
            add.mutate(values)
          })(event)
        }}
      >
        <FieldSet>
          <Field>
            <FieldLabel htmlFor={`${id}-url`}>
              <Trans>Webcal address</Trans>
            </FieldLabel>
            <Input
              id={`${id}-url`}
              {...feedInput}
              aria-invalid={!!errors.url}
              {...register('url')}
            />
            <FieldError errors={[errors.url]} />
          </Field>
          <Field>
            <FieldLabel htmlFor={`${id}-name`}>
              <Trans>Name (optional)</Trans>
            </FieldLabel>
            <Input
              id={`${id}-name`}
              {...nameInput}
              placeholder={nameOfFeed(watch(urlField))}
              {...register('name')}
            />
          </Field>
        </FieldSet>

        {add.isError && <Problem message={webcalErrorMessage(add.error)} />}

        <div className="flex gap-2">
          <Button type="submit" className="h-9 flex-1" disabled={add.isPending}>
            {add.isPending && <Loader2 className="animate-spin" aria-hidden="true" />}
            <Trans>Add</Trans>
          </Button>
          <Button
            type="button"
            variant="outline"
            className="h-9 flex-1"
            disabled={add.isPending}
            onClick={() => {
              add.reset()
              reset(empty)
              setAdding(false)
            }}
          >
            <Trans>Cancel</Trans>
          </Button>
        </div>
      </form>
    </SourceCard>
  )
}
