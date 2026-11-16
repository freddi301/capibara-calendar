import { uniqBy } from 'es-toolkit'
import { createDAVClient } from 'tsdav'
import { calendarColors } from '../../lib/calendar-color'
import { failedStatus, mkcalendarBody, proppatchBody } from '../../lib/calendar-xml'
import { resolveUrl } from '../../lib/connection'
import { HttpError } from '../../lib/errors'
import { proxyFetch } from '../../lib/proxy-fetch'
import {
  ApiError,
  calendarId as makeCalendarId,
  eventId as makeEventId,
  opaqueData,
  revision,
  type Calendar,
  type CalendarEvent,
  type Contact,
  type CalendarRef,
  type CalendarSource,
  type CalendarValues,
  type DateRange,
  type EditScope,
  type EventRef,
  type ImportItem,
  type ImportOutcome,
  type EventPatch,
  type EventValues,
  type ListOptions,
  type Revision,
  type SourceInfo,
} from '../calendar-api'
import {
  deleteDocument,
  occurrenceFor,
  occurrencesOf,
  sortByStart,
  toCalendarEvent,
  updateDocument,
  type Occurrence,
} from '../shared/documents'
import type { StoredEvent } from '../stored-documents'
import { clientScheduled, decode, encode, fileNameOf, withUid, type Resource } from './codec'
import { parseVCard } from './contacts'
import { discoverServerUrl } from './discovery'
import { fetchRights, rightsFor } from './privileges'
import { assertOk, toApiError } from './errors'

export type CaldavSettings = { url: string; username: string; password: string }

async function connect({ url, username, password }: CaldavSettings) {
  const written = resolveUrl(url)
  if (!written) throw new Error(`Not an address: ${url}`)
  const serverUrl = await discoverServerUrl(written)
  const client = await createDAVClient({
    serverUrl,
    credentials: { username, password },
    fetch: proxyFetch,
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  })
  const account = await client.createAccount({ account: { accountType: 'caldav', serverUrl } })
  const eventCalendars = async () =>
    (await client.fetchCalendars({ account })).filter((calendar) =>
      calendar.components?.includes('VEVENT'),
    )
  const rightsAsked = fetchRights(account.homeUrl ?? serverUrl, basic({ username, password }))
  let calendars = await eventCalendars()
  if (!calendars.length) {
    await client.makeCalendar({
      url: new URL('calendar/', account.homeUrl).href,
      props: {
        displayname: 'Calendar',
        supportedCalendarComponentSet: { comp: { _attributes: { name: 'VEVENT' } } },
      },
    })
    calendars = await eventCalendars()
  }
  return {
    client,
    serverUrl,
    calendars,
    rights: await rightsAsked,
    homeUrl: account.homeUrl ?? serverUrl,
    principalUrl: account.principalUrl,
    credentials: { username, password },
  }
}

const basic = ({ username, password }: { username: string; password: string }) =>
  `Basic ${btoa(String.fromCharCode(...new TextEncoder().encode(`${username}:${password}`)))}`

function timeRange({ start, end }: DateRange) {
  const instant = (date: string) =>
    Temporal.PlainDate.from(date).toZonedDateTime('UTC').toInstant().toString()
  return {
    start: instant(Temporal.PlainDate.from(start).subtract({ days: 1 }).toString()),
    end: instant(Temporal.PlainDate.from(end).add({ days: 2 }).toString()),
  }
}

export class CaldavSource implements CalendarSource {
  readonly info: SourceInfo
  private readonly settings: CaldavSettings
  private connection: ReturnType<typeof connect> | undefined

  constructor(info: SourceInfo, settings: CaldavSettings) {
    this.info = info
    this.settings = settings
  }

  private connected() {
    this.connection ??= connect(this.settings).catch((error: unknown) => {
      this.connection = undefined
      throw error
    })
    return this.connection
  }

  private async run<Result>(work: () => Promise<Result>) {
    try {
      return await work()
    } catch (error) {
      throw toApiError(error, this.info.id)
    }
  }

  private write<Result>(work: () => Promise<Result>) {
    return this.run(() => {
      if (!navigator.onLine) throw new ApiError('unreachable', { sourceId: this.info.id })
      return work()
    })
  }

  private async calendarOf(calendar: CalendarRef) {
    const { client, calendars } = await this.connected()
    const found = calendars.find(({ url }) => url === calendar.calendarId)
    if (!found) throw new ApiError('notFound', { sourceId: this.info.id })
    return { client, calendar: found, calendars }
  }

  check() {
    return this.run(async () => {
      await connect(this.settings)
    })
  }

  async listContacts(): Promise<Contact[]> {
    try {
      const { client, serverUrl } = await this.connected()
      const account = await client.createAccount({ account: { accountType: 'carddav', serverUrl } })
      const books = await client.fetchAddressBooks({ account })
      const cards = (
        await Promise.all(books.map((addressBook) => client.fetchVCards({ addressBook })))
      ).flat()
      const contacts = cards
        .map(({ data }) => (typeof data === 'string' ? parseVCard(data) : undefined))
        .filter((contact) => contact !== undefined)
      return uniqBy(contacts, ({ id }) => id).sort((first, second) =>
        first.name.localeCompare(second.name),
      )
    } catch {
      return []
    }
  }

  listCalendars() {
    return this.run(async () => {
      const { calendars, rights } = await this.connected()
      const colors = calendarColors(
        calendars.map(({ url, calendarColor }) => ({ url, color: calendarColor })),
      )
      return calendars.map(({ url, displayName }): Calendar => ({
        ref: { sourceId: this.info.id, calendarId: makeCalendarId(url) },
        name: typeof displayName === 'string' ? displayName : url,
        color: colors.get(url) ?? '',
        rights: rightsFor(rights, url),
      }))
    })
  }

  private async send(method: string, url: string, body?: string) {
    const { credentials } = await this.connected()
    const response = await proxyFetch(url, {
      method,
      headers: {
        Authorization: basic(credentials),
        'Content-Type': 'application/xml; charset=utf-8',
      },
      body: body ?? null,
    })
    assertOk(response)
    const status = response.status === 207 ? failedStatus(await response.text()) : undefined
    if (status) throw new HttpError(status)
    this.connection = undefined
  }

  createCalendar(values: CalendarValues) {
    return this.write(async () => {
      const { homeUrl } = await this.connected()
      const url = new URL(`${crypto.randomUUID()}/`, homeUrl).href
      await this.send('MKCALENDAR', url, mkcalendarBody(values))
      const created = (await this.listCalendars()).find(({ ref }) => ref.calendarId === url)
      if (!created) throw new ApiError('notFound', { sourceId: this.info.id })
      return created
    })
  }

  updateCalendar(calendar: CalendarRef, values: Partial<CalendarValues>) {
    return this.write(async () => {
      const current = (await this.listCalendars()).find(
        ({ ref }) => ref.calendarId === calendar.calendarId,
      )
      if (!current) throw new ApiError('notFound', { sourceId: this.info.id })
      await this.send('PROPPATCH', calendar.calendarId, proppatchBody({ ...current, ...values }))
      const updated = (await this.listCalendars()).find(
        ({ ref }) => ref.calendarId === calendar.calendarId,
      )
      return updated ?? { ...current, ...values }
    })
  }

  deleteCalendar(calendar: CalendarRef) {
    return this.write(() => this.send('DELETE', calendar.calendarId))
  }

  private eventsOf(
    object: { url: string; etag?: string; data?: unknown },
    calendar: { url: string },
    pick: (doc: StoredEvent) => Occurrence[],
  ): CalendarEvent[] {
    if (typeof object.data !== 'string') return []
    const resource = decode(object.data)
    if (!resource) return []
    const doc = this.documentOf(object.url, calendar.url, resource)
    return pick(doc).map((occurrence) => this.eventFor(doc, occurrence, object, calendar.url))
  }

  private documentOf(url: string, calendarUrl: string, resource: Resource): StoredEvent {
    return {
      id: makeEventId(url),
      calendarId: makeCalendarId(calendarUrl),
      revision: 0,
      event: resource.event,
      recurrenceOverrides: resource.recurrenceOverrides,
    }
  }

  private eventFor(
    doc: StoredEvent,
    occurrence: Occurrence,
    object: { etag?: string; data?: unknown },
    calendarUrl: string,
  ): CalendarEvent {
    return {
      ...toCalendarEvent(doc, occurrence, {
        sourceId: this.info.id,
        calendarId: makeCalendarId(calendarUrl),
        color: this.colors?.get(calendarUrl),
      }),
      revision: revision(object.etag ?? ''),
      opaque: opaqueData(String(object.data)),
    }
  }

  private colors: Map<string, string> | undefined

  listEvents(calendar: CalendarRef, range: DateRange, options: ListOptions) {
    return this.run(async () => {
      const { client, calendar: found, calendars } = await this.calendarOf(calendar)
      this.colors = calendarColors(
        calendars.map(({ url, calendarColor }) => ({ url, color: calendarColor })),
      )
      const objects = await client
        .fetchCalendarObjects({ calendar: found, timeRange: timeRange(range) })
        .catch((error: unknown) => {
          const failed = toApiError(error, this.info.id)
          if (failed.kind !== 'notFound') throw failed
          this.connection = undefined
          return []
        })
      const events = objects.flatMap((object) =>
        this.eventsOf(object, found, (doc) => occurrencesOf(doc, range, options.timeZone)),
      )
      return sortByStart(events, options.timeZone)
    })
  }

  selfAddresses() {
    return this.run(async () => {
      const { client, principalUrl, credentials } = await this.connected()
      const found = new Set<string>()
      try {
        if (!principalUrl) throw new Error('no principal')
        const answer = await client.propfind({
          url: principalUrl,
          props: { 'c:calendar-user-address-set': {} },
          depth: '0',
        })
        for (const [address] of JSON.stringify(answer).matchAll(/mailto:[^"\\\s<]+/gi)) {
          found.add(address.toLowerCase())
        }
      } catch {
        // The server does not say: the name of the account is used, if it is an address.
      }
      if (credentials.username.includes('@'))
        found.add(`mailto:${credentials.username.toLowerCase()}`)
      return [...found]
    })
  }

  importEvents(calendar: CalendarRef, items: ImportItem[]) {
    return this.write(async () => {
      const { client, calendar: found } = await this.calendarOf(calendar)
      const objects = await client.fetchCalendarObjects({ calendar: found })
      const byUid = new Map<string, (typeof objects)[number]>()
      for (const object of objects) {
        const resource = typeof object.data === 'string' ? decode(object.data) : undefined
        if (resource) byUid.set(resource.uid, object)
      }
      const outcomes: ImportOutcome[] = []
      for (const { uid, ics } of items) {
        try {
          const data = clientScheduled(ics)
          const existing = byUid.get(uid)
          if (existing) {
            assertOk(
              await client.updateCalendarObject({
                calendarObject: { url: existing.url, etag: existing.etag, data },
              }),
            )
          } else {
            assertOk(
              await client.createCalendarObject({
                calendar: found,
                filename: `${fileNameOf(uid)}.ics`,
                iCalString: data,
              }),
            )
          }
          outcomes.push({ uid, result: existing ? 'updated' : 'created' })
        } catch (error) {
          outcomes.push({ uid, result: 'failed', error: toApiError(error, this.info.id).kind })
        }
      }
      return outcomes
    })
  }

  exportEvents(calendar: CalendarRef) {
    return this.run(async () => {
      const { client, calendar: found } = await this.calendarOf(calendar)
      const objects = await client.fetchCalendarObjects({ calendar: found })
      return objects.flatMap(({ data }) => (typeof data === 'string' && data ? [data] : []))
    })
  }

  revision(calendar: CalendarRef): Promise<Revision | undefined> {
    return this.run(async () => {
      const { client, calendar: found } = await this.calendarOf(calendar)
      try {
        const { newCtag } = await client.isCollectionDirty({ collection: found })
        return newCtag ? revision(newCtag) : undefined
      } catch {
        return undefined
      }
    })
  }

  private async objectOf(event: EventRef) {
    const { client, calendar } = await this.calendarOf(event)
    const objects = await client.fetchCalendarObjects({
      calendar,
      objectUrls: [event.eventId],
    })
    const object = objects.at(0)
    if (typeof object?.data !== 'string') throw new ApiError('notFound', { sourceId: this.info.id })
    return { object, calendar }
  }

  getEvent(event: EventRef) {
    return this.run(async () => {
      const { object, calendar } = await this.objectOf(event)
      const found = this.eventsOf(object, calendar, (doc) => {
        const occurrence = occurrenceFor(doc, event.recurrenceId)
        return occurrence ? [occurrence] : []
      }).at(0)
      if (!found) throw new ApiError('notFound', { sourceId: this.info.id })
      return found
    })
  }

  createEvent(calendar: CalendarRef, values: EventValues) {
    return this.write(async () => {
      const { client, calendar: found } = await this.calendarOf(calendar)
      const uid = crypto.randomUUID()
      const ics = encode({ uid, event: values, recurrenceOverrides: {} })
      assertOk(
        await client.createCalendarObject({
          calendar: found,
          filename: `${uid}.ics`,
          iCalString: ics,
        }),
      )
      return this.getEvent({
        ...calendar,
        eventId: makeEventId(new URL(`${uid}.ics`, found.url).href),
      })
    })
  }

  private resourceOf(event: CalendarEvent) {
    const ics = event.opaque
    const resource = ics ? decode(ics) : undefined
    if (!ics || !resource)
      throw new ApiError('unknown', { sourceId: this.info.id, message: 'The event cannot be read' })
    return { ics, resource }
  }

  updateEvent(event: CalendarEvent, patch: EventPatch, scope: EditScope) {
    return this.write(async () => {
      const { client, calendar } = await this.calendarOf(event.ref)
      const { ics, resource } = this.resourceOf(event)
      const doc = this.documentOf(event.ref.eventId, calendar.url, resource)
      const base = new URL('./', calendar.url).href
      const changes = updateDocument(doc, patch, event.ref.recurrenceId, scope, () =>
        makeEventId(new URL(`${crypto.randomUUID()}.ics`, base).href),
      )
      for (const written of changes.write.filter(({ id }) => id !== doc.id)) {
        const uid = crypto.randomUUID()
        const data = encode(
          { uid, event: written.event, recurrenceOverrides: written.recurrenceOverrides },
          withUid(ics, uid),
        )
        assertOk(
          await client.createCalendarObject({
            calendar,
            filename: `${uid}.ics`,
            iCalString: data,
          }),
        )
      }
      const same = changes.write.find(({ id }) => id === doc.id)
      if (same) {
        const data = encode(
          { uid: resource.uid, event: same.event, recurrenceOverrides: same.recurrenceOverrides },
          ics,
        )
        assertOk(
          await client.updateCalendarObject({
            calendarObject: { url: event.ref.eventId, etag: event.revision, data },
          }),
        )
        // What the change left of the occurrence, when it is still there: after a split it is not.
        return this.getEvent({
          ...event.ref,
          recurrenceId: scope === 'all' ? undefined : event.ref.recurrenceId,
        }).catch((error: unknown) => {
          if (error instanceof ApiError && error.kind === 'notFound') return event
          throw error
        })
      }
      return event
    })
  }

  deleteEvent(event: CalendarEvent, scope: EditScope) {
    return this.write(async () => {
      const { client, calendar } = await this.calendarOf(event.ref)
      const { ics, resource } = this.resourceOf(event)
      const doc = this.documentOf(event.ref.eventId, calendar.url, resource)
      const changes = deleteDocument(doc, event.ref.recurrenceId, scope)
      const same = changes.write.find(({ id }) => id === doc.id)
      if (same) {
        const data = encode(
          { uid: resource.uid, event: same.event, recurrenceOverrides: same.recurrenceOverrides },
          ics,
        )
        assertOk(
          await client.updateCalendarObject({
            calendarObject: { url: event.ref.eventId, etag: event.revision, data },
          }),
        )
        return
      }
      assertOk(
        await client.deleteCalendarObject({
          calendarObject: { url: event.ref.eventId, etag: event.revision },
        }),
      )
    })
  }

  moveEvent(event: CalendarEvent, to: CalendarRef) {
    return this.write(async () => {
      const { client } = await this.connected()
      const { calendar: target } = await this.calendarOf(to)
      const { ics } = this.resourceOf(event)
      const filename = `${crypto.randomUUID()}.ics`
      assertOk(await client.createCalendarObject({ calendar: target, filename, iCalString: ics }))
      assertOk(
        await client.deleteCalendarObject({
          calendarObject: { url: event.ref.eventId, etag: event.revision },
        }),
      )
      return this.getEvent({ ...to, eventId: makeEventId(new URL(filename, target.url).href) })
    })
  }
}
