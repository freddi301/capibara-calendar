import { createDAVClient } from 'tsdav'
import type { EventFormValues } from './event-schema'
import { calendarColors } from './calendar-color'
import { type Connection, loadConnection, resolveUrl } from './connection'
import { HttpError } from './errors'
import { proxyFetch } from './proxy-fetch'
import { buildEvent, parseEvents, patchEvent } from './ical'
import { activeTimeZone } from './settings'
import type { DateRange } from './week'

export type CalendarInfo = { url: string; name: string; color: string }

export type CalendarEvent = EventFormValues & {
  uid: string
  url: string
  etag?: string
  ics: string
  isRecurring?: boolean
  color?: string
}

async function connect({ url, username, password }: Connection) {
  const serverUrl = resolveUrl(url)
  if (!serverUrl) throw new Error(`Not an address: ${url}`)
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
  return { client, calendars }
}

let connection: ReturnType<typeof connect> | undefined
function getConnection() {
  const saved = loadConnection()
  if (!saved) return Promise.reject(new Error('Not connected to a server'))
  connection ??= connect(saved).catch((error: unknown) => {
    connection = undefined // retry from scratch next time
    throw error
  })
  return connection
}

export function resetConnection() {
  connection = undefined
}

export async function checkConnection(candidate: Connection) {
  await connect(candidate)
}

const colorsOf = (calendars: { url: string; calendarColor?: string }[]) =>
  calendarColors(calendars.map(({ url, calendarColor }) => ({ url, color: calendarColor })))

export async function listCalendars(): Promise<CalendarInfo[]> {
  const { calendars } = await getConnection()
  const colors = colorsOf(calendars)
  return calendars.map(({ url, displayName }) => ({
    url,
    name: typeof displayName === 'string' ? displayName : url,
    color: colors.get(url) ?? '',
  }))
}

function assertOk(response: Response) {
  if (!response.ok) throw new HttpError(response.status)
}

function timeRange({ start, end }: DateRange) {
  const instant = (date: string) =>
    Temporal.PlainDate.from(date).toZonedDateTime('UTC').toInstant().toString()
  return {
    start: instant(Temporal.PlainDate.from(start).subtract({ days: 1 }).toString()),
    end: instant(Temporal.PlainDate.from(end).add({ days: 2 }).toString()),
  }
}

export async function listEvents(range: DateRange): Promise<CalendarEvent[]> {
  const { client, calendars } = await getConnection()
  const timeZone = activeTimeZone()
  const colors = colorsOf(calendars)
  const perCalendar = await Promise.all(
    calendars.map(async (calendar) => {
      const objects = await client.fetchCalendarObjects({ calendar, timeRange: timeRange(range) })
      return objects.flatMap(({ url, etag, data }) => {
        if (typeof data !== 'string') return []
        return parseEvents(data, timeZone, range).map((event) => ({
          ...event,
          calendarUrl: calendar.url,
          color: colors.get(calendar.url),
          url,
          etag,
          ics: data,
        }))
      })
    }),
  )
  return perCalendar
    .flat()
    .sort((a, b) => `${a.startDate} ${a.startTime}`.localeCompare(`${b.startDate} ${b.startTime}`))
}

export async function saveEvent(values: EventFormValues, existing?: CalendarEvent) {
  const { client, calendars } = await getConnection()
  const timeZone = activeTimeZone()
  if (existing?.calendarUrl === values.calendarUrl) {
    const { url, etag, ics } = existing
    assertOk(
      await client.updateCalendarObject({
        calendarObject: { url, etag, data: patchEvent(ics, values, timeZone) },
      }),
    )
    return
  }

  const calendar = calendars.find(({ url }) => url === values.calendarUrl)
  if (!calendar) throw new Error(`Unknown calendar: ${values.calendarUrl}`)
  assertOk(
    await client.createCalendarObject({
      calendar,
      filename: `${crypto.randomUUID()}.ics`,
      iCalString: existing
        ? patchEvent(existing.ics, values, timeZone)
        : buildEvent(values, crypto.randomUUID(), timeZone),
    }),
  )
  if (existing) await deleteEvent(existing)
}

export async function deleteEvent({ url, etag }: CalendarEvent) {
  const { client } = await getConnection()
  assertOk(await client.deleteCalendarObject({ calendarObject: { url, etag } }))
}
