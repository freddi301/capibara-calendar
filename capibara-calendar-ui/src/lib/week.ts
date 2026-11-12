import type { CalendarEvent } from './caldav'

export type DateRange = { start: string; end: string }

export function weekDays(date: Temporal.PlainDate, weekStart = 1) {
  const first = date.subtract({ days: (date.dayOfWeek - weekStart + 7) % 7 })
  return Array.from({ length: 7 }, (_, index) => first.add({ days: index }))
}

export const monthTableWeeks = 6

export function monthWeeks(date: Temporal.PlainDate, weekStart = 1, atLeast = 0) {
  const first = weekDays(date.with({ day: 1 }), weekStart)[0]
  const last = weekDays(date.with({ day: date.daysInMonth }), weekStart)[6]
  const needed = (first.until(last, { largestUnit: 'days' }).days + 1) / 7
  return Array.from({ length: Math.max(needed, atLeast) }, (_, index) =>
    weekDays(first.add({ weeks: index }), weekStart),
  )
}

function weekRange(date: Temporal.PlainDate, weekStart = 1): DateRange {
  const days = weekDays(date, weekStart)
  return { start: days[0].toString(), end: days[6].toString() }
}

function monthRange(date: Temporal.PlainDate, weekStart = 1): DateRange {
  const weeks = monthWeeks(date, weekStart, monthTableWeeks)
  return { start: weeks[0][0].toString(), end: weeks[weeks.length - 1][6].toString() }
}

const agendaLength = 366

export const agendaFirstMonths = 3
export const agendaMoreMonths = 3

export function agendaRange(from: Temporal.PlainDate, months?: number): DateRange {
  const year = from.add({ days: agendaLength - 1 })
  const end = months ? Temporal.PlainDate.compare(from.add({ months }), year) : 1
  return {
    start: from.toString(),
    end: (end < 0 ? from.add({ months }).subtract({ days: 1 }) : year).toString(),
  }
}

type PagesOf = (
  date: Temporal.PlainDate,
  weekStart: number,
) => { day: Temporal.PlainDate; range: DateRange }[]

export function isFarPage(
  pagesOf: PagesOf,
  selected: Temporal.PlainDate,
  day: Temporal.PlainDate,
  weekStart: number,
) {
  const shown = pagesOf(selected, weekStart).map(({ range }) => range.start)
  return !shown.includes(pagesOf(day, weekStart)[1].range.start)
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
  const days = [...list.querySelectorAll<HTMLElement>('[data-day]')].flatMap((element) =>
    element.dataset.day
      ? [{ day: element.dataset.day, top: element.getBoundingClientRect().top }]
      : [],
  )
  const began = days.filter((day) => day.top <= top + 8).map(({ day }) => day)
  return (
    began.sort().at(-1) ??
    days
      .map(({ day }) => day)
      .sort()
      .at(0)
  )
}

export function offsetInDay(list: HTMLElement, day: string | undefined) {
  const element = day
    ? [...list.querySelectorAll<HTMLElement>('[data-day]')].find((item) => item.dataset.day === day)
    : undefined
  if (!day || !element) return {}
  return {
    day,
    offset: Math.max(0, list.getBoundingClientRect().top - element.getBoundingClientRect().top),
  }
}

export const entryKey = ({ event }: DayEntry) =>
  `${event.url} ${event.startDate} ${event.startTime}`

export const weekPages = (date: Temporal.PlainDate, weekStart = 1) =>
  [-1, 0, 1]
    .map((offset) => date.add({ weeks: offset }))
    .map((day) => ({ day, range: weekRange(day, weekStart) }))

export const monthPages = (date: Temporal.PlainDate, weekStart = 1) =>
  [-1, 0, 1]
    .map((offset) => date.add({ months: offset }))
    .map((day) => ({ day, range: monthRange(day, weekStart) }))
