import { uniqBy } from 'es-toolkit'
import {
  ApiError,
  type Calendar,
  type Contact,
  type ContactId,
  type CalendarApi,
  type CalendarEvent,
  type CalendarRef,
  type CalendarSource,
  type CalendarValues,
  type DateRange,
  type EditScope,
  type EventRef,
  type ImportItem,
  type EventPatch,
  type EventValues,
  type ListOptions,
  type ParticipationStatus,
  type Revision,
  type SourceCalendars,
  type SourceConfig,
  type SourceId,
  type SourceInfo,
} from './calendar-api'

export type SourceBuilder = (config: SourceConfig, secrets: { password?: string }) => CalendarSource

function seriesValuesOf(event: CalendarEvent): EventValues {
  return {
    title: event.title,
    description: event.description,
    start: event.series?.start ?? event.start,
    timeZone: event.timeZone,
    duration: event.duration,
    showWithoutTime: event.showWithoutTime,
    locations: event.locations,
    virtualLocations: event.virtualLocations,
    keywords: event.keywords,
    alerts: event.alerts,
    recurrenceRules: event.recurrenceRules,
    status: event.status,
    color: event.color,
    participants: event.participants,
    organizer: event.organizer,
  }
}

export class Registry implements CalendarApi {
  private readonly held = new Map<SourceId, CalendarSource>()
  private readonly build: SourceBuilder

  constructor(build: SourceBuilder, sources: CalendarSource[] = []) {
    this.build = build
    for (const source of sources) this.held.set(source.info.id, source)
  }

  private source(id: SourceId) {
    const source = this.held.get(id)
    if (!source) throw new ApiError('notFound', { message: `Unknown source: ${id}` })
    return source
  }

  sources(): SourceInfo[] {
    return [...this.held.values()].map(({ info }) => info)
  }

  async addSource(config: SourceConfig, secrets: { password?: string }) {
    const source = this.build(config, secrets)
    await source.check()
    this.held.set(source.info.id, source)
    return source.info
  }

  removeSource(id: SourceId) {
    this.held.delete(id)
    return Promise.resolve()
  }

  async listCalendars(): Promise<SourceCalendars[]> {
    return Promise.all(
      [...this.held.values()].map(async (source): Promise<SourceCalendars> => {
        try {
          return { sourceId: source.info.id, calendars: await source.listCalendars() }
        } catch (error) {
          const failed =
            error instanceof ApiError
              ? error
              : new ApiError('unknown', { sourceId: source.info.id, cause: error })
          return { sourceId: source.info.id, error: failed }
        }
      }),
    )
  }

  createCalendar(source: SourceId, values: CalendarValues): Promise<Calendar> {
    return this.source(source).createCalendar(values)
  }

  updateCalendar(calendar: CalendarRef, values: Partial<CalendarValues>): Promise<Calendar> {
    return this.source(calendar.sourceId).updateCalendar(calendar, values)
  }

  deleteCalendar(calendar: CalendarRef) {
    return this.source(calendar.sourceId).deleteCalendar(calendar)
  }

  listEvents(calendar: CalendarRef, range: DateRange, options: ListOptions) {
    return this.source(calendar.sourceId).listEvents(calendar, range, options)
  }

  revision(calendar: CalendarRef): Promise<Revision | undefined> {
    return this.source(calendar.sourceId).revision(calendar)
  }

  getEvent(event: EventRef) {
    return this.source(event.sourceId).getEvent(event)
  }

  async selfAddresses(sourceId: SourceId) {
    return (await this.source(sourceId).selfAddresses?.()) ?? []
  }

  exportEvents(calendar: CalendarRef) {
    return this.source(calendar.sourceId).exportEvents(calendar)
  }

  importEvents(calendar: CalendarRef, items: ImportItem[]) {
    return this.source(calendar.sourceId).importEvents(calendar, items)
  }

  createEvent(calendar: CalendarRef, values: EventValues) {
    return this.source(calendar.sourceId).createEvent(calendar, values)
  }

  updateEvent(event: CalendarEvent, patch: EventPatch, scope: EditScope) {
    return this.source(event.ref.sourceId).updateEvent(event, patch, scope)
  }

  deleteEvent(event: CalendarEvent, scope: EditScope) {
    return this.source(event.ref.sourceId).deleteEvent(event, scope)
  }

  async moveEvent(event: CalendarEvent, to: CalendarRef): Promise<CalendarEvent> {
    const from = this.source(event.ref.sourceId)
    if (event.ref.sourceId === to.sourceId && from.moveEvent) return from.moveEvent(event, to)
    const values = seriesValuesOf(event)
    const created = await this.source(to.sourceId).createEvent(to, values)
    await from.deleteEvent(event, 'all')
    return created
  }

  subscribe(listener: () => void) {
    const stops = [...this.held.values()].map((source) => source.subscribe?.(listener))
    return () => {
      for (const stop of stops) stop?.()
    }
  }

  async listContacts(): Promise<Contact[]> {
    const lists = await Promise.all(
      [...this.held.values()].map(async (source) => {
        try {
          return (await source.listContacts?.()) ?? []
        } catch {
          return []
        }
      }),
    )
    return uniqBy(lists.flat(), ({ id }) => id)
  }

  async updateParticipation(
    event: CalendarEvent,
    participant: ContactId,
    status: ParticipationStatus,
  ) {
    const latest = await this.source(event.ref.sourceId).getEvent(event.ref)
    return this.updateEvent(
      latest,
      { participants: { set: [{ id: participant, status }], remove: [] } },
      'all',
    )
  }
}
