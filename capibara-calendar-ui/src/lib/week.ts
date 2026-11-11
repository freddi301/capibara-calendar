import type { CalendarEvent } from './caldav'

export type DateRange = { start: string; end: string }

export function weekDays(date: Temporal.PlainDate, weekStart = 1) {
  const first = date.subtract({ days: (date.dayOfWeek - weekStart + 7) % 7 })
  return Array.from({ length: 7 }, (_, index) => first.add({ days: index }))
}

export function monthWeeks(date: Temporal.PlainDate, weekStart = 1) {
  const first = weekDays(date.with({ day: 1 }), weekStart)[0]
  const last = weekDays(date.with({ day: date.daysInMonth }), weekStart)[6]
  const count = (first.until(last, { largestUnit: 'days' }).days + 1) / 7
  return Array.from({ length: count }, (_, index) =>
    weekDays(first.add({ weeks: index }), weekStart),
  )
}

export function weekRange(date: Temporal.PlainDate, weekStart = 1): DateRange {
  const days = weekDays(date, weekStart)
  return { start: days[0].toString(), end: days[6].toString() }
}

export function monthRange(date: Temporal.PlainDate, weekStart = 1): DateRange {
  const weeks = monthWeeks(date, weekStart)
  return { start: weeks[0][0].toString(), end: weeks[weeks.length - 1][6].toString() }
}

const agendaLength = 366

export function agendaRange(from: Temporal.PlainDate): DateRange {
  return { start: from.toString(), end: from.add({ days: agendaLength - 1 }).toString() }
}

export type DayEntry = { event: CalendarEvent; start: string; end: string }

export function eventsOn(events: CalendarEvent[], date: Temporal.PlainDate): DayEntry[] {
  const day = date.toString()
  return events
    .filter(({ startDate, endDate }) => day >= startDate && day <= (endDate || startDate))
    .map((event) => ({
      event,
      start: day === event.startDate ? event.startTime : '',
      end: day === (event.endDate || event.startDate) ? event.endTime : '',
    }))
    .sort(
      (a, b) =>
        Number(!!a.start) - Number(!!b.start) ||
        (a.start || a.end).localeCompare(b.start || b.end) ||
        a.event.title.localeCompare(b.event.title),
    )
}

export function agendaDays(events: CalendarEvent[], from: Temporal.PlainDate, days = agendaLength) {
  return Array.from({ length: days }, (_, index) => from.add({ days: index }))
    .map((day) => ({ day, entries: eventsOn(events, day) }))
    .filter(({ entries }) => entries.length)
}

export function dayAtTop(list: HTMLElement) {
  const top = list.getBoundingClientRect().top
  const days = [...list.querySelectorAll<HTMLElement>('[data-day]')]
  const current = days.filter((day) => day.getBoundingClientRect().top <= top + 8).at(-1)
  return (current ?? days.at(0))?.dataset.day
}

export const entryKey = ({ event }: DayEntry) =>
  `${event.url} ${event.startDate} ${event.startTime}`
