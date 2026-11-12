import type { CalendarId, EventId, EventValues, LocalDateTime } from './calendar-api'

export type StoredCalendar = {
  id: CalendarId
  name: string
  color: string
  order: number
  revision: number
}

export type RecurrenceOverride = Partial<EventValues> | { excluded: true }

export type StoredEvent = {
  id: EventId
  calendarId: CalendarId
  revision: number
  event: EventValues
  recurrenceOverrides: Record<LocalDateTime, RecurrenceOverride>
}
