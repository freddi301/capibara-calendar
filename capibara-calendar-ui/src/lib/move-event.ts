import { cn } from 'cn'
import type { CalendarEvent, CalendarRights } from '@/api/calendar-api'
import type { DisplayEvent } from './display-event'
import { eventPatchOf, formValuesOf } from './event-form'

export const cardLooks = {
  lifted: cn('bg-muted shadow-lg hover:bg-muted dark:hover:bg-muted'),
  origin: cn(
    'border-r-transparent! border-b-transparent! bg-red-500/25 hover:bg-red-500/25 dark:bg-red-500/25 dark:hover:bg-red-500/25 [&>*]:invisible',
  ),
  target: cn('bg-blue-500/25'),
}

export const liftedProps = { 'data-slot': 'lifted-card' }

export const arcSvg = {
  viewBox: '0 0 16 40',
  stroke: 'currentColor',
  strokeWidth: 1.5,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  preserveAspectRatio: 'xMinYMid meet',
} as const
export const arcParts = {
  curve: { d: 'M12 10H3.5Q2 10 2 11.5V28.5Q2 30 3.5 30H8.5', fill: 'none' },
  head: { d: 'M8 26.4 14 30 8 33.6Z', fill: 'currentColor' },
}

const safe = (text: string) => text.replace(/[^a-zA-Z0-9_-]/g, '-')
export const transitionNameOf = ({ key, startDate, endDate }: DisplayEvent, day: string) =>
  `card-${safe(key)}${endDate && endDate !== startDate ? `-${day}` : ''}`

export function canMoveEvent({ source, isRecurring }: DisplayEvent, rights?: CalendarRights) {
  return (
    !isRecurring &&
    !source.ref.recurrenceId &&
    source.organizer === null &&
    (rights?.update ?? true)
  )
}

export const daysBetween = (from: string, to: string) =>
  Temporal.PlainDate.from(from).until(Temporal.PlainDate.from(to), { largestUnit: 'days' }).days

export const shiftDate = (date: string, days: number) =>
  date ? Temporal.PlainDate.from(date).add({ days }).toString() : date

export function movePatch(event: CalendarEvent, days: number, appZone: string) {
  const options = { appZone }
  const initial = formValuesOf(event, options)
  const moved = {
    ...initial,
    startDate: shiftDate(initial.startDate, days),
    endDate: shiftDate(initial.endDate, days),
  }
  return eventPatchOf(moved, initial, event, options)
}
