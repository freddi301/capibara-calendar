import { zodResolver } from '@hookform/resolvers/zod'
import { Trans, useLingui } from '@lingui/react/macro'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react'
import { cn } from 'cn'
import { useEffect, useId, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import BottomBar from '@/components/BottomBar'
import ColorPicker from '@/components/ColorPicker'
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
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { createCalendar, deleteCalendar, updateCalendar, type CalendarInfo } from '@/lib/caldav'
import { palette } from '@/lib/calendar-color'
import { createCalendarSchema, nameField, type CalendarValues } from '@/lib/calendar-schema'
import { calendarErrorMessage, isRetryable } from '@/lib/errors'
import { hiddenCalendars, saveHiddenCalendars } from '@/lib/filter'
import { nameInput } from '@/lib/input-attributes'
import { useCalendars } from '@/lib/use-calendars'

type CalendarEditScreenProps = {
  calendar?: CalendarInfo
  onClose: () => void
}

export default function CalendarEditScreen({ calendar, onClose }: CalendarEditScreenProps) {
  const { t } = useLingui()
  const nameId = useId()
  const queryClient = useQueryClient()
  const calendars = useCalendars()
  const [isConfirmingDelete, setConfirmingDelete] = useState(false)

  // What the server has is not what was cached: its calendars, and the events of each.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['calendars'] }),
      queryClient.invalidateQueries({ queryKey: ['events'] }),
    ])
  const save = useMutation({
    mutationFn: (values: CalendarValues) =>
      calendar ? updateCalendar(calendar, values) : createCalendar(values),
    onSuccess: refresh,
  })
  const remove = useMutation({
    mutationFn: deleteCalendar,
    onSuccess: async (_result, { url }) => {
      saveHiddenCalendars(hiddenCalendars().filter((hidden) => hidden !== url))
      await refresh()
    },
  })
  const isBusy = save.isPending || remove.isPending

  const {
    register,
    control,
    handleSubmit,
    setFocus,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<CalendarValues>({
    resolver: zodResolver(createCalendarSchema()),
    defaultValues: { name: calendar?.name ?? '', color: calendar?.color ?? palette[0].color },
  })
  useEffect(() => {
    if (!calendar) setFocus(nameField) // a new calendar starts with its name
  }, [calendar, setFocus])
  // A new calendar has a color that the others do not have, as soon as it is known which they are.
  const taken = calendars.data?.map(({ color }) => color.toLowerCase())
  useEffect(() => {
    if (calendar || !taken || getValues('color') !== palette[0].color) return
    const free = palette.find(({ color }) => !taken.includes(color))
    if (free) setValue('color', free.color)
  }, [calendar, taken, getValues, setValue])

  const submit = handleSubmit((values) => {
    remove.reset()
    save.mutate(values, { onSuccess: onClose })
  })

  return (
    <>
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-6 p-4 pb-16">
        <h1 className="text-2xl font-bold text-muted-foreground">
          {calendar ? <Trans>Edit calendar</Trans> : <Trans>New calendar</Trans>}
        </h1>
        <form id="calendar-form" noValidate className="flex flex-col gap-6" onSubmit={submit}>
          <Field>
            <FieldLabel htmlFor={nameId}>
              <Trans>Name</Trans>
            </FieldLabel>
            <Input id={nameId} {...nameInput} aria-invalid={!!errors.name} {...register('name')} />
            <FieldError errors={[errors.name]} />
          </Field>

          <Controller
            control={control}
            name="color"
            render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
          />

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
          onClick={onClose}
        >
          <ArrowLeft />
        </Button>
        {calendar && (
          <Button
            variant="ghost"
            className="ml-auto size-11 text-destructive"
            aria-label={t`Delete`}
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

      <AlertDialog open={isConfirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Delete this calendar?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              <Trans>All its events are deleted with it. This cannot be undone.</Trans>
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
              <Trans>Delete</Trans>
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
