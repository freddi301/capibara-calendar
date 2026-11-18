import { zodResolver } from '@hookform/resolvers/zod'
import { Trans, useLingui } from '@lingui/react/macro'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Info, Loader2, Save, Trash2, Undo2 } from 'lucide-react'
import { cn } from 'cn'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { useEffect, useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import AvailabilitySelect from '@/components/AvailabilitySelect'
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
import RowZone from '@/components/RowZone'
import { timeInZone } from '@/lib/zone-choice'
import { Button } from '@/components/ui/button'
import { FieldError } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { getApi } from '@/api'
import { timeZoneId, type CalendarEvent, type EditScope } from '@/api/calendar-api'
import { displayTimes } from '@/api/shared/zones'
import SourceIcon, { SourceTag } from '@/components/SourceIcon'
import ColorSelect from '@/components/ColorSelect'
import ParticipantsBlock from '@/components/ParticipantsBlock'
import ParticipantsEditor from '@/components/ParticipantsEditor'
import StatusIcon from '@/components/StatusIcon'
import { groupBySource, refOfKey } from '@/lib/calendars'
import { statusLabels } from '@/lib/status-labels'
import {
  endFields,
  eventPatchOf,
  eventValuesOf,
  formValuesOf,
  hasCustomAlerts,
} from '@/lib/event-form'
import { colorBorder, colorMark } from '@/lib/calendar-color'
import { conflictOf, errorMessage, isConflict, isRetryable } from '@/lib/errors'
import {
  createEventSchema,
  detailDefaults,
  repeatEndings,
  availabilities,
  statuses,
  type EventFormValues,
} from '@/lib/event-schema'
import { eventQueryKey, monthsBetween, refreshEvents } from '@/lib/event-chunks'
import { activeTimeZone } from '@/lib/settings'
import { useCalendars } from '@/lib/use-calendars'
import { useBackHandler } from '@/lib/overlay-history'
import { useLeaveGuard } from '@/lib/use-leave-guard'

type CreateEditEventScreenProps = {
  event?: CalendarEvent
  copyOf?: CalendarEvent
  scope?: EditScope
  date?: string
  onDiscard?: () => void
  onSaved?: (saved: CalendarEvent) => void
  onClose: () => void
}

export default function CreateEditEventScreen({
  event,
  copyOf,
  scope,
  date,
  onDiscard,
  onSaved,
  onClose,
}: CreateEditEventScreenProps) {
  const { t, i18n } = useLingui()
  const [formRef] = useAutoAnimate()
  const queryClient = useQueryClient()
  const calendars = useCalendars()
  const appZone = timeZoneId(activeTimeZone())
  const options = { scope, date, appZone }
  const times = event ? displayTimes(event, appZone) : undefined
  const isRecurring = (event?.recurrenceRules.length ?? 0) > 0
  const calendarOfEvent = event ? `${event.ref.sourceId}/${event.ref.calendarId}` : undefined
  const save = useMutation({
    mutationFn: async ({ values, isForced }: { values: EventFormValues; isForced: boolean }) => {
      const api = getApi()
      const target = refOfKey(values.calendarUrl)
      if (!event) return api.createEvent(target, eventValuesOf(values, undefined, options))
      const current = isForced ? await api.getEvent(event.ref) : event
      const patch = eventPatchOf(values, initial, current, options)
      const updated = await api.updateEvent(current, patch, scope ?? 'all')
      const isMoved =
        target.sourceId !== event.ref.sourceId || target.calendarId !== event.ref.calendarId
      return isMoved && scope !== 'one' ? api.moveEvent(updated, target) : updated
    },
    onSuccess: (result, { values }) => {
      if (event) queryClient.removeQueries({ queryKey: eventQueryKey(event.ref) })
      queryClient.setQueryData(eventQueryKey(result.ref), result)
      return refreshEvents(
        queryClient,
        [...new Set([calendarOfEvent ?? values.calendarUrl, values.calendarUrl])],
        values.repeat || isRecurring
          ? undefined
          : monthsBetween([
              times?.startDate ?? '',
              times?.endDate ?? '',
              values.startDate,
              values.endDate,
            ]),
      )
    },
  })
  const remove = useMutation({
    mutationFn: async ({ existing, isForced }: { existing: CalendarEvent; isForced: boolean }) => {
      const api = getApi()
      return api.deleteEvent(isForced ? await api.getEvent(existing.ref) : existing, scope ?? 'all')
    },
    onSuccess: (_result, { existing }) =>
      refreshEvents(
        queryClient,
        [`${existing.ref.sourceId}/${existing.ref.calendarId}`],
        existing.recurrenceRules.length > 0
          ? undefined
          : monthsBetween([times?.startDate ?? '', times?.endDate ?? '']),
      ),
  })
  const [isConfirmingDelete, setConfirmingDelete] = useState(false)
  const isOneOccurrence = isRecurring && scope === 'one'
  const isFollowing = !!event?.ref.recurrenceId && scope === 'following'
  const isBusy = save.isPending || remove.isPending
  const start = formValuesOf(event ?? copyOf, options)
  const [initial] = useState<EventFormValues>(() => ({
    ...start,
    repeat: start.repeat ?? '',
    repeatUntil: start.repeatUntil ?? '',
    repeatInterval: start.repeatInterval ?? '1',
    repeatDays: start.repeatDays ?? [],
    repeatCount: start.repeatCount ?? '',
    repeatEnds: start.repeatEnds ?? repeatEndings[0],
    location: start.location ?? detailDefaults.location,
    coordinates: start.coordinates ?? detailDefaults.coordinates,
    alerts: start.alerts ?? detailDefaults.alerts,
    tags: start.tags ?? detailDefaults.tags,
    videoLink: start.videoLink ?? detailDefaults.videoLink,
    status: start.status ?? statuses[0],
    availability: start.availability ?? availabilities[0],
    eventColor: start.eventColor ?? '',
    participants: (start.participants ?? []).map((guest) =>
      copyOf ? { ...guest, status: 'needs-action' as const } : guest,
    ),
  }))
  const form = useForm<EventFormValues>({
    resolver: zodResolver(createEventSchema()),
    mode: 'onChange',
    defaultValues: initial,
  })
  const {
    register,
    control,
    handleSubmit,
    getValues,
    setValue,
    trigger,
    resetField,
    formState: { errors, isDirty },
  } = form

  const afterSave = (saved: CalendarEvent) => {
    if (onSaved) onSaved(saved)
    else onClose()
  }

  const submit = handleSubmit((values) => {
    remove.reset()
    save.mutate({ values, isForced: false }, { onSuccess: afterSave })
  })

  const guard = useLeaveGuard(isDirty, event && onDiscard ? onDiscard : onClose)
  useBackHandler(guard.leave)

  const own =
    event &&
    calendars.data?.find(
      ({ ref }) => ref.sourceId === event.ref.sourceId && ref.calendarId === event.ref.calendarId,
    )
  const selectable = (calendars.data ?? []).filter(
    ({ url, rights }) => rights.create || url === own?.url,
  )
  const canRemove = own?.rights.remove ?? true
  const items = selectable.map(({ url, name, sourceKind, sourceName }) => ({
    value: url,
    label: (
      <span className="flex min-w-0 flex-1 items-center gap-2">
        <span className="min-w-0 flex-1 truncate">{name}</span>
        <SourceTag kind={sourceKind} name={sourceName} className="max-w-[40%]" />
      </span>
    ),
  }))
  const colorOf = (url: string) => calendars.data?.find((calendar) => calendar.url === url)?.color

  const firstCalendar = selectable.at(0)?.url
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
  const zone = useWatch({ control, name: 'timeZone' }) ?? ''
  const endZone = useWatch({ control, name: 'endTimeZone' }) ?? ''
  const startInApp = timeInZone(zone, appZone, startDate, startTime)
  const endInApp = timeInZone(endZone, appZone, endDate || startDate, endTime)
  const endInStart = timeInZone(endZone, zone, endDate || startDate, endTime)
  const range = {
    startDate,
    startTime,
    endDate: endInStart?.date ?? endDate,
    endTime: endInStart?.time ?? endTime,
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto w-full max-w-lg flex-1 p-4">
        <form
          ref={formRef}
          id="event-form"
          noValidate
          className="flex flex-col gap-4"
          onSubmit={submit}
        >
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
                  className={cn('w-full', colorOf(field.value) && 'border-r-4')}
                  style={colorBorder(colorOf(field.value))}
                  aria-label={t`Calendar`}
                  aria-invalid={!!errors.calendarUrl}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {groupBySource(selectable).map((group) => (
                    <SelectGroup key={group.sourceId}>
                      <SelectLabel className="flex min-h-11 items-center gap-2 px-3 text-sm">
                        <span className="min-w-0 flex-1 truncate">{group.name}</span>
                        <SourceIcon kind={group.kind} />
                      </SelectLabel>
                      {group.calendars.map(({ url, name }) => (
                        <SelectItem
                          key={url}
                          value={url}
                          {...colorMark}
                          className={cn('min-h-11', colorOf(url) && 'border-r-4')}
                          style={colorBorder(colorOf(url))}
                        >
                          {name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
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
            <Controller
              control={control}
              name="timeZone"
              render={({ field }) => (
                <RowZone
                  label={t`Time zone of the start`}
                  value={field.value ?? ''}
                  appZone={appZone}
                  isFloatingAllowed
                  inAppZone={startInApp}
                  onChange={(next) => {
                    const previous = field.value
                    field.onChange(next)
                    if (!endZone || endZone === previous) setValue('endTimeZone', next)
                    void trigger([...endFields])
                  }}
                />
              )}
            />

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
            <Controller
              control={control}
              name="endTimeZone"
              render={({ field }) => (
                <RowZone
                  label={t`Time zone of the end`}
                  value={field.value ?? ''}
                  appZone={appZone}
                  isFloatingAllowed={false}
                  inAppZone={endInApp}
                  isDisabled={!zone}
                  onChange={(next) => {
                    field.onChange(next)
                    void trigger([...endFields])
                  }}
                />
              )}
            />
          </div>
          <FieldError
            errors={[errors.startDate, errors.startTime, errors.endDate, errors.endTime]}
          />

          {!isOneOccurrence && <RepeatFields form={form} />}

          <EventDetails form={form} hasCustomAlerts={hasCustomAlerts(event?.alerts ?? [])} />

          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <Controller
                control={control}
                name="status"
                render={({ field }) => (
                  <Select
                    items={statuses.map((value) => ({
                      value,
                      label: (
                        <span className="flex items-center gap-2">
                          <StatusIcon status={value} />
                          {i18n._(statusLabels[value])}
                        </span>
                      ),
                    }))}
                    value={field.value ?? statuses[0]}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-full min-w-0" aria-label={t`Status`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {statuses.map((value) => (
                        <SelectItem key={value} value={value} className="min-h-11">
                          <StatusIcon status={value} />
                          {i18n._(statusLabels[value])}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="min-w-0 flex-1">
              <Controller
                control={control}
                name="availability"
                render={({ field }) => (
                  <AvailabilitySelect
                    value={field.value ?? availabilities[0]}
                    onChange={field.onChange}
                  />
                )}
              />
            </div>
            <Controller
              control={control}
              name="eventColor"
              render={({ field }) => (
                <ColorSelect
                  value={field.value ?? ''}
                  onChange={field.onChange}
                  label={t`Event color`}
                />
              )}
            />
          </div>

          <Textarea
            aria-label={t`Description`}
            placeholder={t`Description`}
            rows={4}
            {...register('description')}
          />

          <Controller
            control={control}
            name="participants"
            render={({ field }) => (
              <ParticipantsBlock statuses={(field.value ?? []).map(({ status }) => status)}>
                <ParticipantsEditor
                  value={field.value ?? []}
                  isReadOnly={event?.organizer != null}
                  onChange={field.onChange}
                />
              </ParticipantsBlock>
            )}
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
          isRecurring && (
            <p
              role="note"
              className="flex items-center gap-2 bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
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
        {event && canRemove && (
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
            save.mutate({ ...save.variables, isForced: true }, { onSuccess: afterSave })
          } else if (remove.variables) {
            remove.mutate({ ...remove.variables, isForced: true }, { onSuccess: onClose })
          }
        }}
        onReload={() => {
          if (event)
            void refreshEvents(queryClient, [`${event.ref.sourceId}/${event.ref.calendarId}`])
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
              ) : isRecurring ? (
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
    </div>
  )
}
