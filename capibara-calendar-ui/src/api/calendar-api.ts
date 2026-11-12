type Brand<Value, Name extends string> = Value & { readonly __brand: Name }

export type IsoDate = Brand<string, 'IsoDate'>
export type LocalDateTime = Brand<string, 'LocalDateTime'>
export type UtcDateTime = Brand<string, 'UtcDateTime'>
export type Duration = Brand<string, 'Duration'>
export type SignedDuration = Brand<string, 'SignedDuration'>
export type TimeZoneId = Brand<string, 'TimeZoneId'>
export type SourceId = Brand<string, 'SourceId'>
export type CalendarId = Brand<string, 'CalendarId'>
export type EventId = Brand<string, 'EventId'>
export type Revision = Brand<string, 'Revision'>
export type OpaqueData = Brand<string, 'OpaqueData'>
export type CalendarKey = Brand<string, 'CalendarKey'>
export type EventKey = Brand<string, 'EventKey'>

export const isoDate = (value: string) => value as IsoDate
export const localDateTime = (value: string) => value as LocalDateTime
export const utcDateTime = (value: string) => value as UtcDateTime
export const duration = (value: string) => value as Duration
export const signedDuration = (value: string) => value as SignedDuration
export const timeZoneId = (value: string) => value as TimeZoneId
export const sourceId = (value: string) => value as SourceId
export const calendarId = (value: string) => value as CalendarId
export const eventId = (value: string) => value as EventId
export const revision = (value: string) => value as Revision
export const opaqueData = (value: string) => value as OpaqueData

export type DateRange = { start: IsoDate; end: IsoDate }

export type SourceKind = 'caldav' | 'local' | 'memory'

export type Day = 'mo' | 'tu' | 'we' | 'th' | 'fr' | 'sa' | 'su'

export type RecurrenceFrequency =
  'yearly' | 'monthly' | 'weekly' | 'daily' | 'hourly' | 'minutely' | 'secondly'

export type RecurrenceRule = {
  frequency: RecurrenceFrequency
  interval?: number
  firstDayOfWeek?: Day
  byDay?: { day: Day; nthOfPeriod?: number }[]
  byMonthDay?: number[]
  byMonth?: string[]
  byYearDay?: number[]
  byWeekNo?: number[]
  byHour?: number[]
  byMinute?: number[]
  bySecond?: number[]
  bySetPosition?: number[]
  count?: number
  until?: LocalDateTime
}

export type Alert = {
  trigger:
    | { type: 'offset'; offset: SignedDuration; relativeTo: 'start' | 'end' }
    | { type: 'absolute'; when: UtcDateTime }
}

export type EventLocation = { name: string }

export type VirtualLocation = { uri: string; name?: string }

export type EventStatus = 'confirmed' | 'tentative' | 'cancelled'

export type EventValues = {
  title: string
  description: string
  start: LocalDateTime
  timeZone: TimeZoneId | null
  duration: Duration
  showWithoutTime: boolean
  locations: EventLocation[]
  virtualLocations: VirtualLocation[]
  keywords: string[]
  alerts: Alert[]
  recurrenceRules: RecurrenceRule[]
  status: EventStatus
  color: string | null
}

export type CalendarRef = { sourceId: SourceId; calendarId: CalendarId }

export type EventRef = CalendarRef & {
  eventId: EventId
  recurrenceId?: LocalDateTime
}

export type EventSeries = {
  start: LocalDateTime
  recurrenceRulesFromHere: RecurrenceRule[]
}

export type CalendarEvent = EventValues & {
  ref: EventRef
  revision: Revision
  calendarColor?: string
  series?: EventSeries
  opaque?: OpaqueData
}

export type EditScope = 'one' | 'following' | 'all'

export type CalendarValues = { name: string; color: string }

export type Calendar = CalendarValues & { ref: CalendarRef }

export type ApiErrorKind =
  'unauthorized' | 'forbidden' | 'notFound' | 'conflict' | 'unreachable' | 'unknown'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly sourceId?: SourceId
  readonly isRetryable: boolean

  constructor(
    kind: ApiErrorKind,
    options: { message?: string; sourceId?: SourceId; isRetryable?: boolean; cause?: unknown } = {},
  ) {
    super(options.message ?? kind, { cause: options.cause })
    this.kind = kind
    this.sourceId = options.sourceId
    this.isRetryable = options.isRetryable ?? (kind === 'unreachable' || kind === 'unknown')
  }
}

export type SourceInfo = {
  id: SourceId
  kind: SourceKind
  name: string
}

export type ListOptions = { timeZone: TimeZoneId }

export interface CalendarSource {
  readonly info: SourceInfo

  check(): Promise<void>

  listCalendars(): Promise<Calendar[]>
  createCalendar(values: CalendarValues): Promise<Calendar>
  updateCalendar(calendar: CalendarRef, values: Partial<CalendarValues>): Promise<Calendar>
  deleteCalendar(calendar: CalendarRef): Promise<void>

  listEvents(
    calendar: CalendarRef,
    range: DateRange,
    options: ListOptions,
  ): Promise<CalendarEvent[]>
  revision(calendar: CalendarRef): Promise<Revision | undefined>
  getEvent(event: EventRef): Promise<CalendarEvent>

  createEvent(calendar: CalendarRef, values: EventValues): Promise<CalendarEvent>
  updateEvent(event: CalendarEvent, values: EventValues, scope: EditScope): Promise<CalendarEvent>
  deleteEvent(event: CalendarEvent, scope: EditScope): Promise<void>
  moveEvent?(event: CalendarEvent, to: CalendarRef): Promise<CalendarEvent>
}

export type SourceConfig = {
  id: SourceId
  kind: SourceKind
  name: string
  settings: Record<string, string | number | boolean>
}

export interface AdapterFactory {
  readonly kind: SourceKind
  create(config: SourceConfig, secrets: { password?: string }): CalendarSource
}

export type SourceCalendars =
  { sourceId: SourceId; calendars: Calendar[] } | { sourceId: SourceId; error: ApiError }

export interface CalendarApi {
  sources(): SourceInfo[]
  addSource(config: SourceConfig, secrets: { password?: string }): Promise<SourceInfo>
  removeSource(id: SourceId): Promise<void>

  listCalendars(): Promise<SourceCalendars[]>
  createCalendar(source: SourceId, values: CalendarValues): Promise<Calendar>
  updateCalendar(calendar: CalendarRef, values: Partial<CalendarValues>): Promise<Calendar>
  deleteCalendar(calendar: CalendarRef): Promise<void>

  listEvents(
    calendar: CalendarRef,
    range: DateRange,
    options: ListOptions,
  ): Promise<CalendarEvent[]>
  revision(calendar: CalendarRef): Promise<Revision | undefined>
  getEvent(event: EventRef): Promise<CalendarEvent>
  createEvent(calendar: CalendarRef, values: EventValues): Promise<CalendarEvent>
  updateEvent(event: CalendarEvent, values: EventValues, scope: EditScope): Promise<CalendarEvent>
  deleteEvent(event: CalendarEvent, scope: EditScope): Promise<void>
  moveEvent(event: CalendarEvent, to: CalendarRef): Promise<CalendarEvent>
}

export const calendarKey = ({ sourceId, calendarId }: CalendarRef) =>
  `${sourceId}/${calendarId}` as CalendarKey

export const eventKey = (event: EventRef) =>
  `${calendarKey(event)}/${event.eventId}${event.recurrenceId ? `#${event.recurrenceId}` : ''}` as EventKey
