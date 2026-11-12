import type { EventFormValues } from '../lib/event-schema'

/** What the screen tests describe an event with: the form of it, which is turned into the stored event. */
export type CalendarEvent = EventFormValues & {
  uid: string
  url: string
  etag?: string
  ics: string
  isRecurring?: boolean
  occurrenceId?: string
  color?: string
  reminder?: string
}

export type CalendarInfo = { url: string; name: string; color: string }
