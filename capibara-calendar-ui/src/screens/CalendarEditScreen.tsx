import { zodResolver } from '@hookform/resolvers/zod'
import { Trans, useLingui } from '@lingui/react/macro'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react'
import { cn } from 'cn'
import { useEffect, useId, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import BottomBar, { BottomBarTitle } from '@/components/BottomBar'
import ColorSelect from '@/components/ColorSelect'
import DiscardChangesDialog from '@/components/DiscardChangesDialog'
import Problem from '@/components/Problem'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import SourceIcon from '@/components/SourceIcon'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getApi } from '@/api'
import { sourceId } from '@/api/calendar-api'
import type { CalendarInfo } from '@/lib/calendars'
import { createCalendarSchema, nameField, type CalendarValues } from '@/lib/calendar-schema'
import { calendarErrorMessage, isRetryable } from '@/lib/errors'
import { refreshEvents } from '@/lib/event-chunks'
import { nameInput } from '@/lib/input-attributes'
import { useBackHandler } from '@/lib/overlay-history'
import { useLeaveGuard } from '@/lib/use-leave-guard'
import { usePhonePortrait } from '@/lib/use-phone-portrait'
import { setStored } from '@/lib/use-stored'

type CalendarEditScreenProps = {
  calendar?: CalendarInfo
  onClose: () => void
}

export default function CalendarEditScreen({ calendar, onClose }: CalendarEditScreenProps) {
  const { t } = useLingui()
  const nameId = useId()
  const queryClient = useQueryClient()
  const [isConfirmingDelete, setConfirmingDelete] = useState(false)

  const refresh = (url?: string) =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['calendars'] }),
      refreshEvents(queryClient, url ? [url] : []),
    ])
  const sources = getApi()
    .sources()
    .filter(({ kind }) => kind !== 'webcal')
  const isWebcal = calendar?.sourceKind === 'webcal'
  const [chosenSource, setChosenSource] = useState<string>()
  const target = chosenSource ?? sources.at(0)?.id ?? ''
  const save = useMutation({
    mutationFn: (values: CalendarValues) => {
      const api = getApi()
      if (calendar) return api.updateCalendar(calendar.ref, values)
      return api.createCalendar(sourceId(target), values)
    },
    onSuccess: () => refresh(calendar?.url),
  })
  const remove = useMutation({
    mutationFn: (existing: CalendarInfo) => getApi().deleteCalendar(existing.ref),
    onSuccess: async (_result, { url }) => {
      setStored(({ hiddenCalendars }) => ({
        hiddenCalendars: hiddenCalendars.filter((hidden) => hidden !== url),
      }))
      await refresh(url)
    },
  })
  const isBusy = save.isPending || remove.isPending

  const {
    register,
    control,
    handleSubmit,
    setFocus,
    formState: { errors, isDirty },
  } = useForm<CalendarValues>({
    resolver: zodResolver(createCalendarSchema()),
    defaultValues: { name: calendar?.name ?? '', color: calendar?.color ?? '' },
  })
  const guard = useLeaveGuard(isDirty, onClose)
  useBackHandler(guard.leave)
  useEffect(() => {
    if (!calendar) setFocus(nameField)
  }, [calendar, setFocus])

  const submit = handleSubmit((values) => {
    remove.reset()
    save.mutate(values, { onSuccess: onClose })
  })

  const isPhone = usePhonePortrait()
  const title = calendar ? <Trans>Edit calendar</Trans> : <Trans>New calendar</Trans>

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 p-4">
        {isPhone && <h1 className="text-2xl font-bold text-muted-foreground">{title}</h1>}
        <form id="calendar-form" noValidate className="flex flex-col gap-6" onSubmit={submit}>
          <Field>
            <FieldLabel htmlFor={nameId}>
              <Trans>Name</Trans>
            </FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                id={nameId}
                {...nameInput}
                aria-invalid={!!errors.name}
                {...register('name')}
              />
              <Controller
                control={control}
                name="color"
                render={({ field }) => (
                  <ColorSelect
                    value={field.value}
                    onChange={field.onChange}
                    label={t`Calendar color`}
                  />
                )}
              />
            </div>
            <FieldError errors={[errors.name]} />
          </Field>

          {!calendar && sources.length > 1 && (
            <Field>
              <FieldLabel>
                <Trans>Source</Trans>
              </FieldLabel>
              <Select
                items={sources.map(({ id, name }) => ({ value: id, label: name }))}
                value={target}
                onValueChange={(value) => {
                  if (value) setChosenSource(value)
                }}
              >
                <SelectTrigger className="w-full" aria-label={t`Source`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sources.map(({ id, name, kind }) => (
                    <SelectItem key={id} value={id} className="min-h-11">
                      <span className="flex min-w-0 items-center gap-2">
                        <SourceIcon kind={kind} />
                        <span className="truncate">{name}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}

          {save.isError && (
            <Problem
              message={calendarErrorMessage(save.error, 'save')}
              onRetry={isRetryable(save.error) ? () => void submit() : undefined}
            />
          )}
          {remove.isError && (
            <Problem
              message={calendarErrorMessage(remove.error, 'delete')}
              onRetry={
                isRetryable(remove.error) && calendar
                  ? () => {
                      remove.mutate(calendar)
                    }
                  : undefined
              }
            />
          )}
        </form>
      </main>

      <BottomBar>
        <Button
          variant="ghost"
          className="size-11 text-muted-foreground"
          aria-label={t`Back`}
          onClick={guard.leave}
        >
          <ArrowLeft />
        </Button>
        {!isPhone && <BottomBarTitle isCentered>{title}</BottomBarTitle>}
        {calendar && (
          <Button
            variant="ghost"
            className="ml-auto size-11 text-destructive"
            aria-label={isWebcal ? t`Remove` : t`Delete`}
            disabled={isBusy}
            onClick={() => {
              setConfirmingDelete(true)
            }}
          >
            <Trash2 className="size-6" />
          </Button>
        )}
        <Button
          type="submit"
          form="calendar-form"
          variant="ghost"
          className={cn('size-11 text-primary dark:text-sidebar-primary', !calendar && 'ml-auto')}
          aria-label={t`Save`}
          disabled={isBusy}
        >
          {save.isPending ? (
            <Loader2 className="size-6 animate-spin" />
          ) : (
            <Save className="size-6" />
          )}
        </Button>
      </BottomBar>

      <DiscardChangesDialog guard={guard} />

      <AlertDialog open={isConfirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {isWebcal ? <Trans>Remove this Webcal?</Trans> : <Trans>Delete this calendar?</Trans>}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isWebcal ? (
                <Trans>It is removed from here. The calendar itself does not change.</Trans>
              ) : (
                <Trans>All its events are deleted with it. This cannot be undone.</Trans>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              <Trans>Cancel</Trans>
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90 dark:text-background"
              onClick={() => {
                setConfirmingDelete(false)
                save.reset()
                if (calendar) remove.mutate(calendar, { onSuccess: onClose })
              }}
            >
              {isWebcal ? <Trans>Remove</Trans> : <Trans>Delete</Trans>}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
