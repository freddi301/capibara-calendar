import type { DisplayEvent } from '@/lib/display-event'

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

export type AgendaReach = { past: number; future: number }

export const agendaFirstReach: AgendaReach = { past: 1, future: 2 }
export const agendaMoreMonths = 3
export const agendaGapMonths = 12

/** The months of the day, and `past` before it and `future` after it, whole. */
export function agendaRange(anchor: Temporal.PlainDate, { past, future }: AgendaReach): DateRange {
  const month = anchor.toPlainYearMonth()
  const last = month.add({ months: future })
  return {
    start: month.subtract({ months: past }).toPlainDate({ day: 1 }).toString(),
    end: last.toPlainDate({ day: last.daysInMonth }).toString(),
  }
}

export function monthsApart(from: string, to: string) {
  return Temporal.PlainDate.from(to).since(Temporal.PlainDate.from(from), { largestUnit: 'months' })
    .months
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

export type DayEntry = { event: DisplayEvent; start: string; end: string }

export function eventsOn(events: DisplayEvent[], date: Temporal.PlainDate): DayEntry[] {
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

export function agendaDays(events: DisplayEvent[], { start, end }: DateRange) {
  const byDay = new Map<string, DisplayEvent[]>()
  for (const event of events) {
    const finish = event.endDate || event.startDate
    const last = finish < end ? finish : end
    let day = event.startDate > start ? event.startDate : start
    while (day <= last) {
      const found = byDay.get(day)
      if (found) found.push(event)
      else byDay.set(day, [event])
      day = Temporal.PlainDate.from(day).add({ days: 1 }).toString()
    }
  }
  return [...byDay.keys()].sort().map((key) => {
    const day = Temporal.PlainDate.from(key)
    return { day, entries: eventsOn(byDay.get(key) ?? [], day) }
  })
}

export function onListKey(list: HTMLElement | null, handler: () => void) {
  list?.addEventListener('keydown', handler)
  return () => list?.removeEventListener('keydown', handler)
}

export const entryKey = ({ event }: DayEntry) =>
  `${event.key} ${event.startDate} ${event.startTime}`

export const weekPages = (date: Temporal.PlainDate, weekStart = 1) =>
  [-1, 0, 1]
    .map((offset) => date.add({ weeks: offset }))
    .map((day) => ({ day, range: weekRange(day, weekStart) }))

export const monthPages = (date: Temporal.PlainDate, weekStart = 1) =>
  [-1, 0, 1]
    .map((offset) => date.add({ months: offset }))
    .map((day) => ({ day, range: monthRange(day, weekStart) }))
