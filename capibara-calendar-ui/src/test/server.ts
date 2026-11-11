import { vi } from 'vitest'
import { listCalendars, listEvents, type CalendarEvent, type CalendarInfo } from '../lib/caldav'

export function serveEvents(events: CalendarEvent[], calendars?: CalendarInfo[]) {
  const urls = [...new Set(['/c/', ...events.map(({ calendarUrl }) => calendarUrl)])]
  vi.mocked(listCalendars).mockResolvedValue(
    calendars ?? urls.map((url) => ({ url, name: url, color: '' })),
  )
  vi.mocked(listEvents).mockImplementation((calendarUrl) =>
    Promise.resolve(events.filter((event) => event.calendarUrl === calendarUrl)),
  )
}
