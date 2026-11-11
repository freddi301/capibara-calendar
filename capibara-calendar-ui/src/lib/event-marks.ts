import type { CalendarEvent } from './caldav'

export const hasMarks = ({ isRecurring, location, videoLink, reminder }: CalendarEvent) =>
  !!(isRecurring || location || videoLink || reminder)
