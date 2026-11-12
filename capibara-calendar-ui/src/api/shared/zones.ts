import {
  duration,
  isoDate,
  localDateTime,
  type DateRange,
  type Duration,
  type EventValues,
  type IsoDate,
  type LocalDateTime,
  type TimeZoneId,
} from '../calendar-api'

export const plainOf = (local: LocalDateTime) => Temporal.PlainDateTime.from(local)

export const localOf = (plain: Temporal.PlainDateTime) =>
  localDateTime(plain.toString({ smallestUnit: 'second' }))

const dateOf = (local: LocalDateTime) => isoDate(local.slice(0, 10))

export const timeOf = (local: LocalDateTime) => local.slice(11, 16)

export const durationOf = (value: Temporal.Duration) => duration(value.toString())

export const zeroDuration = duration('PT0S')

function zonedStart(values: Pick<EventValues, 'start' | 'timeZone'>, appZone: TimeZoneId) {
  return plainOf(values.start).toZonedDateTime(values.timeZone ?? appZone)
}

function zonedEnd(
  values: Pick<EventValues, 'start' | 'timeZone' | 'duration'>,
  appZone: TimeZoneId,
) {
  return zonedStart(values, appZone).add(Temporal.Duration.from(values.duration))
}

export function lastDayOf(values: Pick<EventValues, 'start' | 'duration'>): IsoDate {
  const days = Temporal.Duration.from(values.duration).days
  const last = plainOf(values.start)
    .toPlainDate()
    .add({ days: Math.max(days - 1, 0) })
  return isoDate(last.toString())
}

export type DisplayTimes = {
  startDate: IsoDate
  startTime: string
  endDate: string
  endTime: string
  isAllDay: boolean
}

export function displayTimes(
  values: Pick<EventValues, 'start' | 'timeZone' | 'duration' | 'showWithoutTime'>,
  appZone: TimeZoneId,
): DisplayTimes {
  if (values.showWithoutTime) {
    const startDate = dateOf(values.start)
    const last = lastDayOf(values)
    return {
      startDate,
      startTime: '',
      endDate: last > startDate ? last : '',
      endTime: '',
      isAllDay: true,
    }
  }
  const start = zonedStart(values, appZone).withTimeZone(appZone)
  const hasEnd = Temporal.Duration.compare(values.duration, zeroDuration, { relativeTo: start }) > 0
  const end = hasEnd ? zonedEnd(values, appZone).withTimeZone(appZone) : undefined
  return {
    startDate: isoDate(start.toPlainDate().toString()),
    startTime: start.toPlainTime().toString({ smallestUnit: 'minute' }),
    endDate: end ? end.toPlainDate().toString() : '',
    endTime: end ? end.toPlainTime().toString({ smallestUnit: 'minute' }) : '',
    isAllDay: false,
  }
}

export function overlapsRange(
  values: Pick<EventValues, 'start' | 'timeZone' | 'duration' | 'showWithoutTime'>,
  range: DateRange,
  appZone: TimeZoneId,
) {
  const { startDate, endDate } = displayTimes(values, appZone)
  return startDate <= range.end && (endDate || startDate) >= range.start
}

export function shiftedDuration(
  from: LocalDateTime,
  to: LocalDateTime,
  zone: TimeZoneId | null,
  appZone: TimeZoneId,
): Duration {
  const start = plainOf(from).toZonedDateTime(zone ?? appZone)
  const end = plainOf(to).toZonedDateTime(zone ?? appZone)
  return durationOf(start.until(end, { largestUnit: 'days', smallestUnit: 'second' }))
}
