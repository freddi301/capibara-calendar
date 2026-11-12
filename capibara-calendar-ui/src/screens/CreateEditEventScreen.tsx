import { zodResolver } from '@hookform/resolvers/zod'
import { Trans, useLingui } from '@lingui/react/macro'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Info, Loader2, Save, Trash2, Undo2 } from 'lucide-react'
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
import ConflictDialog from '@/components/ConflictDialog'
import DiscardChangesDialog from '@/components/DiscardChangesDialog'
import DurationSummary from '@/components/DurationSummary'
import EventDetails from '@/components/EventDetails'
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
import { deleteEvent, latestOf, saveEvent, type CalendarEvent, type EditScope } from '@/lib/caldav'
import { colorBorder, colorMark } from '@/lib/calendar-color'
import { conflictOf, errorMessage, isConflict, isRetryable } from '@/lib/errors'
import {
  createEventSchema,
  detailDefaults,
  repeatEndings,
  type EventFormValues,
} from '@/lib/event-schema'
import { monthsBetween, refreshEvents } from '@/lib/event-chunks'
import { slideUpIn } from '@/lib/motion'
import { parseEvent, repeatFrom } from '@/lib/ical'
import { activeTimeZone } from '@/lib/settings'
import { useCalendars } from '@/lib/use-calendars'
import { useBackHandler } from '@/lib/overlay-history'
import { useLeaveGuard } from '@/lib/use-leave-guard'

type CreateEditEventScreenProps = {
  event?: CalendarEvent
  scope?: EditScope
  date?: string
  /** Leaves the form for the screen of the event, that the form was opened from. */
  onDiscard?: () => void
  onClose: () => void
}

export default function CreateEditEventScreen({
  event,
  scope,
  date,
  onDiscard,
  onClose,
}: CreateEditEventScreenProps) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const calendars = useCalendars()
  const save = useMutation({
    // Forced: over what was changed elsewhere, from the event as it is on the server now.
    mutationFn: async ({ values, isForced }: { values: EventFormValues; isForced: boolean }) =>
      saveEvent(values, isForced && event ? await latestOf(event) : event, scope),
    onSuccess: (_result, { values }) =>
      refreshEvents(
        queryClient,
        [...new Set([event?.calendarUrl ?? values.calendarUrl, values.calendarUrl])],
        values.repeat || event?.isRecurring
          ? undefined
          : monthsBetween([
              event?.startDate ?? '',
              event?.endDate ?? '',
              values.startDate,
              values.endDate,
            ]),
      ),
  })
  const remove = useMutation({
    mutationFn: async ({ existing, isForced }: { existing: CalendarEvent; isForced: boolean }) =>
      deleteEvent(isForced ? await latestOf(existing) : existing, scope),
    onSuccess: (_result, { existing }) =>
      refreshEvents(
        queryClient,
        [existing.calendarUrl],
        existing.isRecurring ? undefined : monthsBetween([existing.startDate, existing.endDate]),
      ),
  })
  const [isConfirmingDelete, setConfirmingDelete] = useState(false)
  const isOneOccurrence = !!event?.isRecurring && scope === 'one'
  const isFollowing = !!event?.occurrenceId && scope === 'following'
  const isBusy = save.isPending || remove.isPending
  const start: EventFormValues = (isFollowing
    ? // From the occurrence on: its day, and the repeat as it goes on from it.
      { ...event, ...repeatFrom(event.ics, event.occurrenceId ?? '', activeTimeZone()) }
    : event?.isRecurring && !isOneOccurrence
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
      location: start.location ?? detailDefaults.location,
      reminder: start.reminder ?? detailDefaults.reminder,
      tags: start.tags ?? detailDefaults.tags,
      showAs: start.showAs ?? detailDefaults.showAs,
      visibility: start.visibility ?? detailDefaults.visibility,
      videoLink: start.videoLink ?? detailDefaults.videoLink,
    },
  })
  const {
    register,
    control,
    handleSubmit,
    getValues,
    resetField,
    formState: { errors, isDirty },
  } = form

  const submit = handleSubmit((values) => {
    remove.reset()
    save.mutate({ values, isForced: false }, { onSuccess: onClose })
  })

  const guard = useLeaveGuard(isDirty, event && onDiscard ? onDiscard : onClose)
  useBackHandler(guard.leave)

  const items = calendars.data?.map(({ url, name }) => ({ value: url, label: name })) ?? []
  const colorOf = (url: string) => calendars.data?.find((calendar) => calendar.url === url)?.color

  const firstCalendar = calendars.data?.at(0)?.url
  useEffect(() => {
    if (firstCalendar && !getValues('calendarUrl')) {
      resetField('calendarUrl', { defaultValue: firstCalendar })
    }
  }, [firstCalendar, getValues, resetField])

  const startDeps: { deps: (keyof EventFormValues)[] } = { deps: ['endDate', 'endTime'] }
  const endDeps: { deps: (keyof EventFormValues)[] } = { deps: ['startDate', 'startTime'] }

  const [startDate, startTime, endDate, endTime] = useWatch({
    control,
    name: ['startDate', 'startTime', 'endDate', 'endTime'],
  })
  const range = { startDate, startTime, endDate, endTime }

  return (
    <>
      <main
        className={cn(
          'mx-auto min-h-dvh max-w-lg p-4',
          event?.isRecurring
            ? 'pt-24 pb-4 phone:pt-4 phone:pb-28'
            : 'pt-15 pb-4 phone:pt-4 phone:pb-16',
        )}
      >
        <form id="event-form" noValidate className="flex flex-col gap-4" onSubmit={submit}>
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
              className="ml-2 w-[6.5rem]"
              {...register('startDate', startDeps)}
            />
            <PickerInput
              type="time"
              aria-label={t`Start time`}
              value={startTime}
              aria-invalid={!!errors.startTime}
              className="mr-2 w-[4.5rem]"
              {...register('startTime', startDeps)}
            />
            <DurationSummary range={range} part="days" />

            <span className="text-right text-muted-foreground">
              <Trans>Ends</Trans>
            </span>
            <PickerInput
              type="date"
              aria-label={t`End date`}
              value={endDate}
              aria-invalid={!!errors.endDate}
              className="ml-2 w-[6.5rem]"
              {...register('endDate', endDeps)}
            />
            <PickerInput
              type="time"
              aria-label={t`End time`}
              value={endTime}
              aria-invalid={!!errors.endTime}
              className="mr-2 w-[4.5rem]"
              {...register('endTime', endDeps)}
            />
            <DurationSummary range={range} part="time" />
          </div>
          <FieldError
            errors={[errors.startDate, errors.startTime, errors.endDate, errors.endTime]}
          />

          {!isOneOccurrence && <RepeatFields form={form} />}

          <EventDetails form={form} />

          <Textarea
            aria-label={t`Description`}
            placeholder={t`Description`}
            rows={4}
            {...register('description')}
          />
          {save.isError && !isConflict(save.error) && (
            <Problem
              message={errorMessage(save.error, 'save')}
              onRetry={isRetryable(save.error) ? () => void submit() : undefined}
            />
          )}
          {remove.isError && !isConflict(remove.error) && (
            <Problem
              message={errorMessage(remove.error, 'delete')}
              onRetry={
                isRetryable(remove.error)
                  ? () => {
                      if (event) remove.mutate({ existing: event, isForced: false })
                    }
                  : undefined
              }
            />
          )}
        </form>
      </main>

      <BottomBar
        notice={
          event?.isRecurring && (
            <p
              role="note"
              className={cn(
                'flex items-center gap-2 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground',
                slideUpIn,
              )}
            >
              <Info className="size-4 shrink-0" />
              {isOneOccurrence ? (
                <Trans>Only this event changes. The others of the repeat stay as they are.</Trans>
              ) : isFollowing ? (
                <Trans>
                  This event and the ones after it change. The ones before stay as they are.
                </Trans>
              ) : (
                <Trans>This event repeats. Changes are made to all its occurrences.</Trans>
              )}
            </p>
          )
        }
      >
        {/* An event that is edited has its changes discarded, and goes back to the screen of the event. */}
        <Button
          variant="ghost"
          className="size-11 text-muted-foreground"
          aria-label={event && onDiscard ? t`Discard changes` : t`Back`}
          onClick={guard.leave}
        >
          {event && onDiscard ? <Undo2 /> : <ArrowLeft />}
        </Button>
        <BottomBarTitle>
          {!event ? <Trans>New event</Trans> : <Trans>Edit event</Trans>}
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

      <ConflictDialog
        action={conflictOf(save.error, remove.error)}
        onOverwrite={() => {
          if (isConflict(save.error) && save.variables) {
            save.mutate({ ...save.variables, isForced: true }, { onSuccess: onClose })
          } else if (remove.variables) {
            remove.mutate({ ...remove.variables, isForced: true }, { onSuccess: onClose })
          }
        }}
        onReload={() => {
          // What is on the server is what the list shows: the changes that were made here are left.
          if (event) void refreshEvents(queryClient, [event.calendarUrl])
          onClose()
        }}
        onCancel={() => {
          save.reset()
          remove.reset()
        }}
      />

      <AlertDialog open={isConfirmingDelete} onOpenChange={setConfirmingDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              <Trans>Delete this event?</Trans>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {isOneOccurrence ? (
                <Trans>Only this event is deleted. The others of the repeat stay.</Trans>
              ) : isFollowing ? (
                <Trans>This event and the ones after it are deleted. The ones before stay.</Trans>
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
                if (event)
                  remove.mutate({ existing: event, isForced: false }, { onSuccess: onClose })
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
