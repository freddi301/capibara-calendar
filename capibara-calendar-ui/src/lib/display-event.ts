import {
  calendarKey,
  eventKey,
  type CalendarEvent,
  type EventStatus,
  type TimeZoneId,
} from '@/api/calendar-api'
import { displayTimes } from '@/api/shared/zones'

export type DisplayEvent = {
  key: string
  calendarKey: string
  title: string
  description: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  location: string
  tags: string
  videoLink: string
  hasAlerts: boolean
  isRecurring: boolean
  status: EventStatus
  color?: string
  source: CalendarEvent
}

export function toDisplayEvent(event: CalendarEvent, appZone: TimeZoneId): DisplayEvent {
  const { startDate, startTime, endDate, endTime } = displayTimes(event, appZone)
  return {
    key: eventKey(event.ref),
    calendarKey: calendarKey(event.ref),
    title: event.title,
    description: event.description,
    startDate,
    startTime,
    endDate,
    endTime,
    location: event.locations.at(0)?.name ?? '',
    tags: event.keywords.join(', '),
    videoLink: event.virtualLocations.at(0)?.uri ?? '',
    hasAlerts: event.alerts.length > 0,
    isRecurring: event.recurrenceRules.length > 0,
    status: event.status,
    color: event.color,
    source: event,
  }
}
