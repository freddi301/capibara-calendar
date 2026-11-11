import { zodResolver } from '@hookform/resolvers/zod'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react'
import { cn } from 'cn'
import { useEffect, useState, type ComponentProps } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import BottomBar, { BottomBarTitle } from '@/components/BottomBar'
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
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { deleteEvent, listCalendars, saveEvent, type CalendarEvent } from '@/lib/caldav'
import { daysSpanned, timeSpanned } from '@/lib/duration'
import { errorMessage, isRetryable } from '@/lib/errors'
import { createEventSchema, type EventFormValues } from '@/lib/event-schema'
import { formatDate, formatTime } from '@/lib/format'
import { parseEvent } from '@/lib/ical'
import { openPicker } from '@/lib/picker'
import { activeTimeZone } from '@/lib/settings'

type CreateEditEventScreenProps = {
  event?: CalendarEvent
  date?: string
  onClose: () => void
}

type PickerInputProps = ComponentProps<typeof Input> & {
  type: 'date' | 'time'
  value: string
}

function PickerInput({ className, type, value, ...props }: PickerInputProps) {
  const { i18n } = useLingui()
  const shown = !value
    ? ''
    : type === 'date'
      ? formatDate(value, i18n.locale)
      : formatTime(value, i18n.locale)
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label className={cn('relative flex h-11 items-center', className)}>
      <Input
        type={type}
        className="peer absolute inset-0 z-10 h-full w-full opacity-0"
        onClick={openPicker}
        {...props}
      />
      <Input
        readOnly
        tabIndex={-1}
        aria-hidden="true"
        aria-invalid={props['aria-invalid']}
        value={shown}
        className="h-8 min-w-0 px-1 text-center peer-focus-visible:border-ring peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50"
      />
    </label>
  )
}

function Problem({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex items-center justify-between gap-3 rounded-md border border-destructive bg-background p-3 text-sm text-destructive"
    >
      <span>{message}</span>
      {onRetry && (
        <Button type="button" variant="outline" onClick={onRetry}>
          <Trans>Try again</Trans>
        </Button>
      )}
    </div>
  )
}

export default function CreateEditEventScreen({
  event,
  date,
  onClose,
}: CreateEditEventScreenProps) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const calendars = useQuery({ queryKey: ['calendars'], queryFn: listCalendars })
  const save = useMutation({
    mutationFn: (values: EventFormValues) => saveEvent(values, event),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
  const remove = useMutation({
    mutationFn: deleteEvent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
  const [isConfirmingDelete, setConfirmingDelete] = useState(false)
  const isBusy = save.isPending || remove.isPending
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors },
  } = useForm<EventFormValues>({
    resolver: zodResolver(createEventSchema()),
    mode: 'onChange',
    defaultValues: (event?.isRecurring
      ? { ...event, ...parseEvent(event.ics, activeTimeZone()) }
      : event) ?? {
      calendarUrl: '',
      title: '',
      description: '',
      startDate: date ?? Temporal.Now.plainDateISO(activeTimeZone()).toString(),
      startTime: '',
      endDate: '',
      endTime: '',
    },
  })

  const submit = handleSubmit((values) => {
    remove.reset()
    save.mutate(values, { onSuccess: onClose })
  })

  const items = calendars.data?.map(({ url, name }) => ({ value: url, label: name })) ?? []

  const firstCalendar = calendars.data?.at(0)?.url
  useEffect(() => {
    if (firstCalendar && !getValues('calendarUrl')) setValue('calendarUrl', firstCalendar)
  }, [firstCalendar, getValues, setValue])

  const startDeps: { deps: (keyof EventFormValues)[] } = { deps: ['endDate', 'endTime'] }
  const endDeps: { deps: (keyof EventFormValues)[] } = { deps: ['startDate', 'startTime'] }

  const [startDate, startTime, endDate, endTime] = useWatch({
    control,
    name: ['startDate', 'startTime', 'endDate', 'endTime'],
  })
  const range = { startDate, startTime, endDate, endTime }
  const time = timeSpanned(range)
  const days = startTime ? time?.days : daysSpanned(range)
  const hours = time?.hours ?? 0
  const minutes = time?.minutes ?? 0
  const showTime = time && (!days || hours > 0 || minutes > 0)

  return (
    <>
      <main className="mx-auto min-h-screen p-4 pb-16">
        <form id="event-form" className="flex flex-col gap-4" onSubmit={submit}>
          {event?.isRecurring && (
            <p className="text-sm text-muted-foreground">
              <Trans>This event repeats. Changes are made to all its occurrences.</Trans>
            </p>
          )}
          <Controller
            control={control}
            name="calendarUrl"
            render={({ field }) => (
              <Select items={items} value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  className="w-full data-[size=default]:h-11"
                  aria-label={t`Calendar`}
                  aria-invalid={!!errors.calendarUrl}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {items.map(({ value, label }) => (
                    <SelectItem key={value} value={value} className="min-h-11">
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError errors={[errors.calendarUrl]} />
          {calendars.isError && (
            <Problem
              message={errorMessage(calendars.error)}
              onRetry={() => void calendars.refetch()}
            />
          )}

          <Textarea
            rows={1}
            aria-label={t`Title`}
            placeholder={t`Title`}
            aria-invalid={!!errors.title}
            className="min-h-0 resize-none border-0 bg-transparent px-0 py-1 text-2xl font-bold shadow-none focus-visible:ring-0 md:text-2xl dark:bg-transparent"
            onKeyDown={(event) => {
              if (event.key === 'Enter') event.preventDefault()
            }}
            {...register('title')}
          />
          <FieldError errors={[errors.title]} />

          <div className="grid grid-cols-[auto_auto_auto_1fr] items-center gap-x-2">
            <span className="text-right text-muted-foreground">
              <Trans>Starts</Trans>
            </span>
            <PickerInput
              type="date"
              aria-label={t`Start date`}
              value={startDate}
              aria-invalid={!!errors.startDate}
              className="ml-2 w-[7.25rem]"
              {...register('startDate', startDeps)}
            />
            <PickerInput
              type="time"
              aria-label={t`Start time`}
              value={startTime}
              aria-invalid={!!errors.startTime}
              className="mr-2 w-[5.5rem]"
              {...register('startTime', startDeps)}
            />
            <span className="text-muted-foreground">
              {days ? <Plural value={days} one="# day" other="# days" /> : null}
            </span>

            <span className="text-right text-muted-foreground">
              <Trans>Ends</Trans>
            </span>
            <PickerInput
              type="date"
              aria-label={t`End date`}
              value={endDate}
              aria-invalid={!!errors.endDate}
              className="ml-2 w-[7.25rem]"
              {...register('endDate', endDeps)}
            />
            <PickerInput
              type="time"
              aria-label={t`End time`}
              value={endTime}
              aria-invalid={!!errors.endTime}
              className="mr-2 w-[5.5rem]"
              {...register('endTime', endDeps)}
            />
            <span className="text-muted-foreground">
              {showTime && (
                <>
                  {hours > 0 && minutes > 0 && (
                    <Trans>
                      {hours} h {minutes} min
                    </Trans>
                  )}
                  {hours > 0 && minutes === 0 && <Trans>{hours} h</Trans>}
                  {hours === 0 && <Trans>{minutes} min</Trans>}
                </>
              )}
            </span>
          </div>
          <FieldError
            errors={[errors.startDate, errors.startTime, errors.endDate, errors.endTime]}
          />

          <Textarea
            aria-label={t`Description`}
            placeholder={t`Description`}
            rows={4}
            {...register('description')}
          />
          {save.isError && (
            <Problem
              message={errorMessage(save.error, 'save')}
              onRetry={isRetryable(save.error) ? () => void submit() : undefined}
            />
          )}
          {remove.isError && (
            <Problem
              message={errorMessage(remove.error, 'delete')}
              onRetry={
                isRetryable(remove.error)
                  ? () => {
                      if (event) remove.mutate(event)
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
        <BottomBarTitle>
          {event ? <Trans>Edit event</Trans> : <Trans>New event</Trans>}
        </BottomBarTitle>
        {event && (
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
          form="event-form"
          variant="ghost"
          className={cn('size-11 text-primary dark:text-sidebar-primary', !event && 'ml-auto')}
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
              <Trans>Delete this event?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {event?.isRecurring ? (
                <Trans>It repeats: all its occurrences are deleted.</Trans>
              ) : (
                <Trans>This cannot be undone.</Trans>
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
                if (event) remove.mutate(event, { onSuccess: onClose })
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
