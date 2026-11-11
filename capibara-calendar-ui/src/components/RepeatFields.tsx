import { plural } from '@lingui/core/macro'
import { Trans, useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { useEffect, type ReactNode } from 'react'
import { Controller, useWatch, type UseFormReturn } from 'react-hook-form'
import PickerInput from '@/components/PickerInput'
import { FieldError } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { capitalize, formatWeekday } from '@/lib/format'
import { numberInput } from '@/lib/input-attributes'
import {
  noRepeat,
  repeatEndings,
  weekdayCodes,
  type EventFormValues,
  type RepeatEnding,
} from '@/lib/event-schema'
import { activeWeekStart } from '@/lib/settings'

function weekDaysFrom(weekStart: number) {
  return Array.from({ length: 7 }, (_, index) => (weekStart - 1 + index) % 7)
}

function RowLabel({ children }: { children: ReactNode }) {
  return <span className="text-right text-muted-foreground">{children}</span>
}

/** How an event repeats, in rows: how often, on which days, and how it ends. */
export default function RepeatFields({ form }: { form: UseFormReturn<EventFormValues> }) {
  const { t, i18n } = useLingui()
  const {
    control,
    register,
    setValue,
    getValues,
    formState: { errors },
  } = form
  const [repeat, ends, interval, startDate, until] = useWatch({
    control,
    name: ['repeat', 'repeatEnds', 'repeatInterval', 'startDate', 'repeatUntil'],
  })
  const isRepeated = !!repeat && repeat !== 'custom'
  const isWeekly = repeat === 'WEEKLY'

  useEffect(() => {
    if (isWeekly && !getValues('repeatDays')?.length && /^\d{4}-\d{2}-\d{2}$/.test(startDate)) {
      setValue('repeatDays', [weekdayCodes[Temporal.PlainDate.from(startDate).dayOfWeek - 1]])
    }
  }, [isWeekly, startDate, getValues, setValue])

  const every = Number(interval) || 1
  const units = [
    { value: 'DAILY', text: plural(every, { one: 'day', other: 'days' }) },
    { value: 'WEEKLY', text: plural(every, { one: 'week', other: 'weeks' }) },
    { value: 'MONTHLY', text: plural(every, { one: 'month', other: 'months' }) },
    { value: 'YEARLY', text: plural(every, { one: 'year', other: 'years' }) },
  ]
  const repeatItems = [
    { value: noRepeat, label: t`Does not repeat` },
    ...units.map(({ value, text }) => ({ value, label: capitalize(text, i18n.locale) })),
    ...(repeat === 'custom' ? [{ value: 'custom', label: t`Custom, kept as it is` }] : []),
  ]
  const endingItems: { value: RepeatEnding; label: string }[] = [
    { value: 'never', label: t`Does not end` },
    { value: 'on', label: t`Ends on` },
    { value: 'after', label: t`Ends after` },
  ]

  const repeatSelect = (
    <Controller
      control={control}
      name="repeat"
      render={({ field }) => (
        <Select
          items={repeatItems}
          value={field.value || noRepeat}
          onValueChange={(chosen) => {
            field.onChange(chosen === noRepeat ? '' : chosen)
          }}
        >
          <SelectTrigger className="w-full min-w-0" aria-label={t`Repeat`}>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {repeatItems.map(({ value, label: text }) => (
              <SelectItem key={value} value={value} className="min-h-11">
                {text}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    />
  )

  return (
    <div className="grid grid-cols-[6.5rem_1fr] items-center gap-x-3 gap-y-3">
      <div className="flex items-center justify-end gap-2">
        {isRepeated && (
          <>
            <RowLabel>
              <Trans>Every</Trans>
            </RowLabel>
            <Input
              {...numberInput}
              aria-label={t`Repeat every`}
              aria-invalid={!!errors.repeatInterval}
              className="w-12 shrink-0 px-1 text-center"
              {...register('repeatInterval')}
            />
          </>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        {repeatSelect}
        <FieldError errors={[errors.repeatInterval]} />
      </div>

      {isWeekly && (
        <>
          <RowLabel>
            <Trans>Repeat on</Trans>
          </RowLabel>
          <Controller
            control={control}
            name="repeatDays"
            render={({ field }) => (
              <div className="flex gap-1">
                {weekDaysFrom(activeWeekStart()).map((index) => {
                  const code = weekdayCodes[index]
                  const isChosen = (field.value ?? []).includes(code)
                  const day = Temporal.PlainDate.from({ year: 2024, month: 1, day: index + 1 })
                  return (
                    <button
                      key={code}
                      type="button"
                      aria-pressed={isChosen}
                      className={cn(
                        'flex size-8 items-center justify-center rounded-full border text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
                        isChosen
                          ? 'border-transparent bg-primary text-primary-foreground'
                          : 'bg-transparent',
                      )}
                      onClick={() => {
                        const chosen = field.value ?? []
                        // One day at least: a repeat every week is on one of them.
                        if (isChosen && chosen.length === 1) return
                        field.onChange(
                          isChosen
                            ? chosen.filter((item) => item !== code)
                            : weekdayCodes.filter((item) => item === code || chosen.includes(item)),
                        )
                      }}
                    >
                      <span className="sr-only">
                        {day.toLocaleString(i18n.locale, { weekday: 'long' })}
                      </span>
                      <span aria-hidden="true">{formatWeekday(day, i18n.locale).slice(0, 2)}</span>
                    </button>
                  )
                })}
              </div>
            )}
          />
        </>
      )}

      {isRepeated && (
        <>
          <div className="col-span-2 flex min-w-0 flex-col gap-1">
            <div className="flex items-center gap-2">
              <Controller
                control={control}
                name="repeatEnds"
                render={({ field }) => (
                  <Select
                    items={endingItems}
                    value={field.value ?? repeatEndings[0]}
                    onValueChange={field.onChange}
                  >
                    <SelectTrigger className="w-40 shrink-0" aria-label={t`How the repeat ends`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {endingItems.map(({ value, label: text }) => (
                        <SelectItem key={value} value={value} className="min-h-11">
                          {text}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {ends === 'on' && (
                <PickerInput
                  type="date"
                  aria-label={t`Repeat until`}
                  value={until ?? ''}
                  aria-invalid={!!errors.repeatUntil}
                  className="w-[7.25rem]"
                  {...register('repeatUntil')}
                />
              )}
              {ends === 'after' && (
                <>
                  <Input
                    {...numberInput}
                    aria-label={t`Repeat this many times`}
                    aria-invalid={!!errors.repeatCount}
                    className="w-12 shrink-0 px-1 text-center"
                    {...register('repeatCount')}
                  />
                  <span className="text-muted-foreground">
                    <Trans>times</Trans>
                  </span>
                </>
              )}
            </div>
            <FieldError errors={[errors.repeatUntil, errors.repeatCount]} />
          </div>
        </>
      )}
    </div>
  )
}
