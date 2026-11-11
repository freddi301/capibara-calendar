import type { EventFields } from './event-schema'

type Range = Pick<EventFields, 'startDate' | 'startTime' | 'endDate' | 'endTime'>

export function daysSpanned({ startDate, endDate }: Range) {
  try {
    const start = Temporal.PlainDate.from(startDate)
    const end = endDate ? Temporal.PlainDate.from(endDate) : start
    const days = start.until(end, { largestUnit: 'days' }).days + 1
    return days >= 1 ? days : undefined
  } catch {
    return undefined // the date is not complete yet
  }
}

export function timeSpanned({ startDate, startTime, endDate, endTime }: Range) {
  if (!startTime || !endTime) return undefined
  try {
    const start = Temporal.PlainDateTime.from(`${startDate}T${startTime}`)
    const end = Temporal.PlainDateTime.from(`${endDate || startDate}T${endTime}`)
    const { days, hours, minutes } = start.until(end, {
      largestUnit: 'days',
      smallestUnit: 'minutes',
    })
    return days < 0 || hours < 0 || minutes < 0 ? undefined : { days, hours, minutes }
  } catch {
    return undefined // the date or time is not complete yet
  }
}
