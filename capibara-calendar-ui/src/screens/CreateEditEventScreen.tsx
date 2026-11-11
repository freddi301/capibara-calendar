import { zodResolver } from '@hookform/resolvers/zod'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2, Save, Trash2 } from 'lucide-react'
import { cn } from 'cn'
import { useEffect, useState } from 'react'
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
import DiscardChangesDialog from '@/components/DiscardChangesDialog'
import PickerInput from '@/components/PickerInput'
import Problem from '@/components/Problem'
import RepeatFields from '@/components/RepeatFields'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { deleteEvent, saveEvent, type CalendarEvent, type EditScope } from '@/lib/caldav'
import { daysSpanned, timeSpanned } from '@/lib/duration'
import { colorBorder, colorMark } from '@/lib/calendar-color'
import { errorMessage, isRetryable } from '@/lib/errors'
import { createEventSchema, repeatEndings, type EventFormValues } from '@/lib/event-schema'
import { parseEvent } from '@/lib/ical'
import { activeTimeZone } from '@/lib/settings'
import { useCalendars } from '@/lib/use-calendars'
import { useLeaveGuard } from '@/lib/use-leave-guard'

type CreateEditEventScreenProps = {
  event?: CalendarEvent
  // For an event that repeats: the occurrence that was opened, or all of them.
  scope?: EditScope
  date?: string
  onClose: () => void
}

export default function CreateEditEventScreen({
  event,
  scope,
  date,
  onClose,
}: CreateEditEventScreenProps) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const calendars = useCalendars()
  const save = useMutation({
    mutationFn: (values: EventFormValues) => saveEvent(values, event, scope),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
  const remove = useMutation({
    mutationFn: (existing: CalendarEvent) => deleteEvent(existing, scope),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
  const [isConfirmingDelete, setConfirmingDelete] = useState(false)
  // Only the occurrence that was opened: its own day, and nothing of the repeat.
  const isOneOccurrence = !!event?.isRecurring && scope === 'one'
  const isBusy = save.isPending || remove.isPending
  // All the occurrences of an event that repeats are edited as the event, from the day it started on.
  const start: EventFormValues = (event?.isRecurring && !isOneOccurrence
    ? { ...event, ...parseEvent(event.ics, activeTimeZone()) }
    : event) ?? {
    calendarUrl: '',
    title: '',
    description: '',
    startDate: date ?? Temporal.Now.plainDateISO(activeTimeZone()).toString(),
    startTime: '',
    endDate: '',
    endTime: '',
  }
  const form = useForm<EventFormValues>({
    resolver: zodResolver(createEventSchema()),
    mode: 'onChange',
    defaultValues: {
      ...start,
      repeat: start.repeat ?? '',
      repeatUntil: start.repeatUntil ?? '',
      repeatInterval: start.repeatInterval ?? '1',
      repeatDays: start.repeatDays ?? [],
      repeatCount: start.repeatCount ?? '',
      repeatEnds: start.repeatEnds ?? repeatEndings[0],
    },
  })
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    formState: { errors, isDirty },
  } = form

  const submit = handleSubmit((values) => {
    remove.reset()
    save.mutate(values, { onSuccess: onClose })
  })

  const guard = useLeaveGuard(isDirty, onClose)

  const items = calendars.data?.map(({ url, name }) => ({ value: url, label: name })) ?? []
  const colorOf = (url: string) => calendars.data?.find((calendar) => calendar.url === url)?.color

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
        <form id="event-form" noValidate className="flex flex-col gap-4" onSubmit={submit}>
          {event?.isRecurring && (
            <p className="text-sm text-muted-foreground">
              {isOneOccurrence ? (
                <Trans>Only this event changes. The others of the repeat stay as they are.</Trans>
              ) : (
                <Trans>This event repeats. Changes are made to all its occurrences.</Trans>
              )}
            </p>
          )}
          <Controller
            control={control}
            name="calendarUrl"
            render={({ field }) => (
              <Select
                items={items}
                value={field.value}
                onValueChange={field.onChange}
                disabled={isOneOccurrence}
              >
                <SelectTrigger
                  {...colorMark}
                  className={cn('w-full', colorOf(field.value) && 'border-l-4')}
                  style={colorBorder(colorOf(field.value))}
                  aria-label={t`Calendar`}
                  aria-invalid={!!errors.calendarUrl}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {items.map(({ value, label }) => (
                    <SelectItem
                      key={value}
                      value={value}
                      {...colorMark}
                      className={cn('min-h-11', colorOf(value) && 'border-l-4')}
                      style={colorBorder(colorOf(value))}
                    >
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

          <div className="grid grid-cols-[auto_auto_auto_1fr] items-center gap-x-2 gap-y-3">
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

          {!isOneOccurrence && <RepeatFields form={form} />}

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
          onClick={guard.leave}
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

      <DiscardChangesDialog guard={guard} />

      <AlertDialog open={isConfirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Delete this event?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isOneOccurrence ? (
                <Trans>Only this event is deleted. The others of the repeat stay.</Trans>
              ) : event?.isRecurring ? (
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
