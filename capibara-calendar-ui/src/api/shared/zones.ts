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

export const durationOf = (value: Temporal.Duration) => duration(value.toString())

export const zeroDuration = duration('PT0S')

/** What the zones of an event need: the end has its own zone when it is not the one of the start. */
type Timing = Pick<EventValues, 'start' | 'timeZone' | 'duration' | 'showWithoutTime'> &
  Partial<Pick<EventValues, 'endTimeZone'>>

function zonedStart(values: Pick<EventValues, 'start' | 'timeZone'>, appZone: TimeZoneId) {
  return plainOf(values.start).toZonedDateTime(values.timeZone ?? appZone)
}

function zonedEnd(values: Omit<Timing, 'showWithoutTime'>, appZone: TimeZoneId) {
  return zonedStart(values, appZone)
    .add(Temporal.Duration.from(values.duration))
    .withTimeZone(values.endTimeZone ?? values.timeZone ?? appZone)
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

export function displayTimes(values: Timing, appZone: TimeZoneId): DisplayTimes {
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

export type OriginalSide = { date: string; time: string; zone: string }

export type OriginalTimes = { start?: OriginalSide; end?: OriginalSide }

const sideOf = (at: Temporal.ZonedDateTime): OriginalSide => ({
  date: at.toPlainDate().toString(),
  time: at.toPlainTime().toString({ smallestUnit: 'minute' }),
  zone: at.timeZoneId,
})

export function originalTimes(values: Timing, appZone: TimeZoneId): OriginalTimes | undefined {
  if (values.showWithoutTime || !values.timeZone) return undefined
  const start = zonedStart(values, appZone)
  const hasEnd = Temporal.Duration.compare(values.duration, zeroDuration, { relativeTo: start }) > 0
  const end = hasEnd ? zonedEnd(values, appZone) : undefined
  const times = {
    start: start.timeZoneId === appZone ? undefined : sideOf(start),
    end: !end || end.timeZoneId === appZone ? undefined : sideOf(end),
  }
  return times.start || times.end ? times : undefined
}

export function overlapsRange(values: Timing, range: DateRange, appZone: TimeZoneId) {
  const { startDate, endDate } = displayTimes(values, appZone)
  return startDate <= range.end && (endDate || startDate) >= range.start
}

export function shiftedDuration(
  from: LocalDateTime,
  to: LocalDateTime,
  zones: { start: TimeZoneId | null; end: TimeZoneId | null },
  appZone: TimeZoneId,
): Duration {
  const startZone = zones.start ?? appZone
  const start = plainOf(from).toZonedDateTime(startZone)
  const end = plainOf(to)
    .toZonedDateTime(zones.end ?? startZone)
    .withTimeZone(startZone)
  return durationOf(start.until(end, { largestUnit: 'days', smallestUnit: 'second' }))
}
