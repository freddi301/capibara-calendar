import type { CalendarEvent } from './caldav'

export function weekDays(date: Temporal.PlainDate, weekStart = 1) {
  const first = date.subtract({ days: (date.dayOfWeek - weekStart + 7) % 7 })
  return Array.from({ length: 7 }, (_, index) => first.add({ days: index }))
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
