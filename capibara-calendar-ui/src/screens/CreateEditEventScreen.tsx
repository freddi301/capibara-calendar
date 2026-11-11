import { zodResolver } from '@hookform/resolvers/zod'
import { Plural, Trans, useLingui } from '@lingui/react/macro'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Save } from 'lucide-react'
import { cn } from 'cn'
import { useEffect, type ComponentProps, type MouseEvent } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import BottomBar, { BottomBarTitle } from '@/components/BottomBar'
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
import { listCalendars, saveEvent, type CalendarEvent } from '@/lib/caldav'
import { daysSpanned, timeSpanned } from '@/lib/duration'
import { createEventSchema, type EventFormValues } from '@/lib/event-schema'

type CreateEditEventScreenProps = {
  event?: CalendarEvent
  onClose: () => void
}

function openPicker(event: MouseEvent<HTMLInputElement>) {
  try {
    event.currentTarget.showPicker()
  } catch {
    // Not supported here, or the picker is already open.
  }
}

function PickerInput({
  className,
  empty,
  ...props
}: ComponentProps<typeof Input> & { empty: boolean }) {
  return (
    // eslint-disable-next-line jsx-a11y/label-has-associated-control
    <label className={cn('flex h-11 items-center', className)}>
      <Input
        className={cn(
          'h-8 min-w-0 px-1 text-center [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-date-and-time-value]:text-center [&::-webkit-datetime-edit-fields-wrapper]:mx-auto',
          'data-[empty=true]:not-focus:text-transparent',
        )}
        data-empty={empty}
        onClick={openPicker}
        {...props}
      />
    </label>
  )
}

export default function CreateEditEventScreen({ event, onClose }: CreateEditEventScreenProps) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const calendars = useQuery({ queryKey: ['calendars'], queryFn: listCalendars })
  const save = useMutation({
    mutationFn: (values: EventFormValues) => saveEvent(values, event),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['events'] }),
  })
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
    defaultValues: event ?? {
      calendarUrl: '',
      title: '',
      description: '',
      startDate: Temporal.Now.plainDateISO().toString(),
      startTime: '',
      endDate: '',
      endTime: '',
    },
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
      <main className="mx-auto min-h-screen max-w-md p-4 pb-16">
        <form
          id="event-form"
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((values) => {
            save.mutate(values, { onSuccess: onClose })
          })}
        >
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
              empty={!startDate}
              aria-invalid={!!errors.startDate}
              className="ml-2 w-[7.25rem]"
              {...register('startDate', startDeps)}
            />
            <PickerInput
              type="time"
              aria-label={t`Start time`}
              empty={!startTime}
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
              empty={!endDate}
              aria-invalid={!!errors.endDate}
              className="ml-2 w-[7.25rem]"
              {...register('endDate', endDeps)}
            />
            <PickerInput
              type="time"
              aria-label={t`End time`}
              empty={!endTime}
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
          <FieldError>{save.error?.message}</FieldError>
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
        <Button
          type="submit"
          form="event-form"
          variant="ghost"
          className="ml-auto size-11 text-primary"
          aria-label={t`Save`}
          disabled={save.isPending}
        >
          <Save className="size-6" />
        </Button>
      </BottomBar>
    </>
  )
}
