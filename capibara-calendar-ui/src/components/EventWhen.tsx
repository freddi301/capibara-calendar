import { useLingui } from '@lingui/react/macro'
import { ArrowRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from 'cn'
import DurationSummary from '@/components/DurationSummary'
import { primaryText as primary, secondaryText as secondary } from '@/lib/hierarchy'
import type { DisplayTimes, OriginalSide, OriginalTimes } from '@/api/shared/zones'
import { activeTimeZone } from '@/lib/settings'
import { zoneName } from '@/lib/zone-choice'
import {
  capitalize,
  formatDay,
  formatDayParts,
  formatTime,
  formatTimeParts,
  fullDateStyle,
} from '@/lib/format'

function TimeText({ time }: { time: string }) {
  const { i18n } = useLingui()
  const parts = formatTimeParts(time, i18n.locale)
  const first = parts.findIndex(({ type }) => type === 'minute')
  return (
    <>
      {parts.map(({ type, text }, index) => (
        <span
          key={index}
          className={cn(
            first >= 0 && index >= first - 1 && 'font-normal',
            type === 'literal' && 'text-muted-foreground',
          )}
        >
          {text}
        </span>
      ))}
    </>
  )
}

function DayLine({
  day,
  options,
}: {
  day: Temporal.PlainDate
  options: Intl.DateTimeFormatOptions
}) {
  const { i18n } = useLingui()
  return (
    <span className={secondary}>
      {formatDayParts(day, i18n.locale, options).map(({ type, text, isKey }, index) => (
        <span
          key={index}
          className={cn(isKey && 'text-lg text-foreground', type === 'day' && 'font-bold')}
        >
          {type === 'month' ? capitalize(text, i18n.locale) : text}
        </span>
      ))}
    </span>
  )
}

type EventWhenProps = {
  event: Pick<DisplayTimes, 'startDate' | 'startTime' | 'endDate' | 'endTime'>
  original?: OriginalTimes
}

function ZoneLines({ zone, children }: { zone: string; children: ReactNode }) {
  return (
    <span className="block text-muted-foreground">
      <span className="block whitespace-nowrap tabular-nums">{children}</span>
      <span className="block text-sm">{zoneName(zone)}</span>
    </span>
  )
}

function TimeAt({ date, time, isDayShown }: { date: string; time: string; isDayShown: boolean }) {
  const { i18n } = useLingui()
  const locale = i18n.locale
  const day = Temporal.PlainDate.from(date)
  return (
    <>
      {isDayShown && (
        <span className="mr-1.5">
          {capitalize(
            formatDay(day, locale, { weekday: 'short', day: 'numeric', month: 'short' }),
            locale,
          )}
        </span>
      )}
      {formatTime(time, locale)}
    </>
  )
}

function Side({
  date,
  time,
  original,
  isEnd = false,
  isCentered = false,
}: {
  date: string
  time: string
  original?: OriginalSide
  isEnd?: boolean
  isCentered?: boolean
}) {
  const { i18n } = useLingui()
  const locale = i18n.locale
  const day = Temporal.PlainDate.from(date)
  const isOtherYear = day.year !== Temporal.Now.plainDateISO(activeTimeZone()).year
  const line = (options: Intl.DateTimeFormatOptions) =>
    capitalize(formatDay(day, locale, options), locale)
  return (
    <div
      className={cn(
        'flex min-w-0 flex-col gap-0.5',
        isEnd && 'items-end text-right',
        isCentered && 'items-center text-center',
      )}
    >
      {time ? (
        <>
          <DayLine
            day={day}
            options={{
              weekday: 'short',
              day: 'numeric',
              month: 'short',
              year: isOtherYear ? 'numeric' : undefined,
            }}
          />
          <span className={cn(primary, 'text-3xl tabular-nums')}>
            <TimeText time={time} />
          </span>
          {original && (
            <ZoneLines zone={original.zone}>
              <TimeAt
                date={original.date}
                time={original.time}
                isDayShown={original.date !== date}
              />
            </ZoneLines>
          )}
        </>
      ) : (
        <>
          <span className={secondary}>
            {line({ weekday: 'long' })}
            {isOtherYear && (
              <>
                , <span className="text-foreground">{day.year}</span>
              </>
            )}
          </span>
          {isCentered ? (
            <span className={cn(primary, 'text-3xl')}>
              {formatDayParts(day, locale, { day: 'numeric', month: 'long' }).map(
                ({ type, text }, index) => (
                  <span key={index} className={cn(type !== 'day' && 'font-normal')}>
                    {type === 'month' ? capitalize(text, locale) : text}
                  </span>
                ),
              )}
            </span>
          ) : (
            <span className={cn(primary, 'text-3xl font-normal')}>
              {formatDayParts(day, locale, { day: 'numeric', month: 'short' }).map(
                ({ type, text }, index) => (
                  <span key={index} className={cn(type === 'day' && 'font-bold')}>
                    {type === 'month' ? capitalize(text, locale) : text}
                  </span>
                ),
              )}
            </span>
          )}
        </>
      )}
    </div>
  )
}

/** The two sides of the event in their own zones, split on the axis of the dash of the time that is shown. */
function AxisLines({ start, end, day }: { start?: OriginalSide; end?: OriginalSide; day: string }) {
  return (
    <span className="grid grid-cols-[1fr_auto_1fr] text-muted-foreground">
      <span className="text-right tabular-nums">
        {start && <TimeAt date={start.date} time={start.time} isDayShown={start.date !== day} />}
      </span>
      <span className={cn('px-2', !(start && end) && 'invisible')}>–</span>
      <span className="text-left tabular-nums">
        {end && (
          <TimeAt date={end.date} time={end.time} isDayShown={end.date !== (start?.date ?? day)} />
        )}
      </span>
      <span className="text-right text-sm">{start && zoneName(start.zone)}</span>
      <span />
      <span className="text-left text-sm">{end && zoneName(end.zone)}</span>
    </span>
  )
}

export default function EventWhen({ event, original }: EventWhenProps) {
  const { startDate, startTime, endDate, endTime } = event
  const lastDate = endDate || startDate
  const range = { startDate, startTime, endDate, endTime }
  const first = Temporal.PlainDate.from(startDate)
  const originalStart = original?.start
  const originalEnd = original?.end

  if (lastDate !== startDate) {
    return (
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-baseline-last gap-3">
        <Side date={startDate} time={startTime} original={originalStart} />
        <div className="flex flex-col items-center gap-0.5 text-center">
          <ArrowRight aria-hidden="true" className="size-5 text-muted-foreground/60" />
          <DurationSummary range={range} part="both" isAlone />
        </div>
        <Side date={lastDate} time={endTime} original={originalEnd} isEnd />
      </div>
    )
  }
  if (!startTime) {
    return <Side date={startDate} time="" isCentered />
  }
  const isOneZone = !!originalStart && !!originalEnd && originalStart.zone === originalEnd.zone
  return (
    <div className="flex flex-col items-center gap-0.5 text-center">
      <DayLine day={first} options={fullDateStyle} />
      <div className="flex flex-wrap items-baseline justify-center gap-x-3">
        <div className="flex flex-col items-center">
          <span className={cn(primary, 'text-3xl tabular-nums')}>
            <TimeText time={startTime} />
            {endTime && (
              <>
                <span className="px-2 font-normal text-muted-foreground">–</span>
                <TimeText time={endTime} />
              </>
            )}
          </span>
          {!isOneZone && (originalStart || originalEnd) && (
            <AxisLines start={originalStart} end={originalEnd} day={startDate} />
          )}
          {isOneZone && (
            <ZoneLines zone={originalStart.zone}>
              <TimeAt
                date={originalStart.date}
                time={originalStart.time}
                isDayShown={originalStart.date !== startDate}
              />
              <span className="px-2">–</span>
              <TimeAt
                date={originalEnd.date}
                time={originalEnd.time}
                isDayShown={originalEnd.date !== originalStart.date}
              />
            </ZoneLines>
          )}
        </div>
        <DurationSummary range={range} part="time" isAlone />
      </div>
    </div>
  )
}
