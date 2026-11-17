import {
  contactId,
  duration,
  localDateTime,
  signedDuration,
  timeZoneId,
  type CalendarRef,
  type CalendarSource,
  type EventValues,
  type Participant,
  type ParticipationStatus,
} from '../api/calendar-api'
import { activeTimeZone } from '../lib/settings'

export type Day = Temporal.PlainDate
export type Planned = [CalendarRef, EventValues]

const colors = ['#2563eb', '#16a34a', '#db2777', '#ea580c', '#7c3aed', '#0891b2', '#ca8a04']
const statuses: ParticipationStatus[] = ['accepted', 'needs-action', 'tentative', 'declined']
export const weekdays = (['mo', 'tu', 'we', 'th', 'fr'] as const).map((day) => ({ day }))

function values(changes: Partial<EventValues>): EventValues {
  return {
    title: '',
    description: '',
    start: localDateTime(''),
    timeZone: timeZoneId(activeTimeZone()),
    endTimeZone: null,
    duration: duration('PT1H'),
    showWithoutTime: false,
    locations: [],
    virtualLocations: [],
    keywords: [],
    alerts: [],
    recurrenceRules: [],
    status: 'confirmed',
    availability: 'busy',
    color: null,
    participants: [],
    organizer: null,
    ...changes,
  }
}

export const timed = (day: Day, time: string, length: string, changes: Partial<EventValues>) =>
  values({
    start: localDateTime(`${day.toString()}T${time}:00`),
    duration: duration(length),
    ...changes,
  })

export const allDay = (day: Day, days: number, changes: Partial<EventValues>) =>
  values({
    start: localDateTime(`${day.toString()}T00:00:00`),
    duration: duration(`P${String(days)}D`),
    showWithoutTime: true,
    timeZone: null,
    endTimeZone: null,
    ...changes,
  })

export const people = (names: string[]): Participant[] =>
  names.map((name, index) => ({
    id: contactId(`mailto:${name}@example.com`),
    status: statuses[index % statuses.length],
  }))

export const reminder = (offset: string) => ({
  trigger: {
    type: 'offset' as const,
    offset: signedDuration(offset),
    relativeTo: 'start' as const,
  },
})

export async function calendars(source: CalendarSource, names: string[]) {
  const created = await Promise.all(
    names.map((name, index) =>
      source.createCalendar({ name, color: colors[index % colors.length] }),
    ),
  )
  return created.map(({ ref }) => ref)
}
