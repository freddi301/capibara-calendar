import { calendarColors } from '../../lib/calendar-color'
import { getStored } from '../../lib/use-stored'
import { changeWebcal, nameOfFeed, removeWebcal } from '../../lib/webcal'
import {
  ApiError,
  calendarId as makeCalendarId,
  eventId as makeEventId,
  revision,
  type Calendar,
  type CalendarEvent,
  type CalendarRef,
  type CalendarSource,
  type CalendarValues,
  type DateRange,
  type EventRef,
  type ListOptions,
  type Revision,
  type SourceInfo,
} from '../calendar-api'
import { occurrenceFor, occurrencesOf, sortByStart, toCalendarEvent } from '../shared/documents'
import { toApiError } from '../caldav/errors'
import type { StoredEvent } from '../stored-documents'
import { readFeed, type Feed } from './feed'

/** A feed is asked for again when what was read is older than this, if it does not say how often it changes. */
const feedMaxAgeMs = 15 * 60 * 1000

/** A feed is one calendar, and its source holds only that one. */
const feedCalendarId = makeCalendarId('feed')

type Loaded = { at: number; feed: Feed; docs: StoredEvent[] }

/** One webcal feed: a source of its own, as a server is, that has one calendar. */
export class WebcalSource implements CalendarSource {
  readonly info: SourceInfo
  private loaded: Loaded | undefined
  private loading: Promise<Loaded> | undefined

  constructor(info: SourceInfo) {
    this.info = info
  }

  private readOnly(): Promise<never> {
    return Promise.reject(
      new ApiError('forbidden', { sourceId: this.info.id, message: 'A webcal is read only' }),
    )
  }

  private async run<Result>(work: () => Promise<Result>) {
    try {
      return await work()
    } catch (error) {
      throw toApiError(error, this.info.id)
    }
  }

  private webcal() {
    const found = getStored().webcals[this.info.id] as
      { url: string; name: string; color?: string } | undefined
    if (!found) throw new ApiError('notFound', { sourceId: this.info.id })
    return found
  }

  private load(): Promise<Loaded> {
    const kept = this.loaded
    if (kept && Date.now() - kept.at < (kept.feed.refreshMs ?? feedMaxAgeMs)) {
      return Promise.resolve(kept)
    }
    const { url } = this.webcal()
    this.loading ??= readFeed(url, kept?.feed)
      .then((feed) => {
        if (kept && feed === kept.feed) {
          this.loaded = { ...kept, at: Date.now() }
          return this.loaded
        }
        const docs = feed.events.map(({ uid, resource }): StoredEvent => ({
          id: makeEventId(uid),
          calendarId: feedCalendarId,
          revision: 1,
          event: resource.event,
          recurrenceOverrides: resource.recurrenceOverrides,
        }))
        this.loaded = { at: Date.now(), feed, docs }
        return this.loaded
      })
      .finally(() => {
        this.loading = undefined
      })
    return this.loading
  }

  private calendar(): Calendar {
    const { url, name, color } = this.webcal()
    const colors = calendarColors(
      Object.entries(getStored().webcals).map(([id, other]) => ({ url: id, color: other.color })),
    )
    return {
      ref: { sourceId: this.info.id, calendarId: feedCalendarId },
      name: name || nameOfFeed(url),
      color: colors.get(this.info.id) ?? color ?? '',
      rights: { create: false, update: false, remove: false },
    }
  }

  private whereOf() {
    const { ref, color } = this.calendar()
    return { sourceId: ref.sourceId, calendarId: ref.calendarId, color }
  }

  check() {
    return Promise.resolve()
  }

  listCalendars() {
    try {
      return Promise.resolve([this.calendar()])
    } catch {
      return Promise.resolve([])
    }
  }

  createCalendar(): Promise<Calendar> {
    return this.readOnly()
  }

  updateCalendar(_calendar: CalendarRef, values: Partial<CalendarValues>) {
    changeWebcal(this.info.id, values)
    return Promise.resolve(this.calendar())
  }

  deleteCalendar() {
    removeWebcal(this.info.id)
    this.loaded = undefined
    return Promise.resolve()
  }

  listEvents(_calendar: CalendarRef, range: DateRange, options: ListOptions) {
    return this.run(async () => {
      const where = this.whereOf()
      const { docs } = await this.load()
      const events = docs.flatMap((doc) =>
        occurrencesOf(doc, range, options.timeZone).map((occurrence) =>
          toCalendarEvent(doc, occurrence, where),
        ),
      )
      return sortByStart(events, options.timeZone)
    })
  }

  revision(): Promise<Revision | undefined> {
    return this.run(async () => revision((await this.load()).feed.stamp))
  }

  getEvent(event: EventRef) {
    return this.run(async () => {
      const { docs } = await this.load()
      const doc = docs.find(({ id }) => id === event.eventId)
      const occurrence = doc && occurrenceFor(doc, event.recurrenceId)
      if (!doc || !occurrence) throw new ApiError('notFound', { sourceId: this.info.id })
      return toCalendarEvent(doc, occurrence, this.whereOf())
    })
  }

  exportEvents() {
    return this.run(async () => (await this.load()).feed.events.map(({ ics }) => ics))
  }

  importEvents(): Promise<never> {
    return this.readOnly()
  }

  createEvent(): Promise<CalendarEvent> {
    return this.readOnly()
  }

  updateEvent(): Promise<CalendarEvent> {
    return this.readOnly()
  }

  deleteEvent(): Promise<void> {
    return this.readOnly()
  }
}
