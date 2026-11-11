import { createDAVClient } from 'tsdav'
import type { EventFormValues } from './event-schema'
import { buildEvent, parseEvent, patchEvent } from './ical'
import { activeTimeZone } from './settings'

export type CalendarInfo = { url: string; name: string }

export type CalendarEvent = EventFormValues & {
  uid: string
  url: string
  etag?: string
  ics: string
}

const serverUrl = new URL('/radicale/', window.location.origin).href
const credentials = { username: 'dev', password: 'dev' }

async function connect() {
  const client = await createDAVClient({
    serverUrl,
    credentials,
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
  connection ??= connect().catch((error: unknown) => {
    connection = undefined // retry from scratch next time
    throw error
  })
  return connection
}

export async function listCalendars(): Promise<CalendarInfo[]> {
  const { calendars } = await getConnection()
  return calendars.map(({ url, displayName }) => ({
    url,
    name: typeof displayName === 'string' ? displayName : url,
  }))
}

export async function listEvents(): Promise<CalendarEvent[]> {
  const { client, calendars } = await getConnection()
  const timeZone = activeTimeZone()
  const perCalendar = await Promise.all(
    calendars.map(async (calendar) => {
      const objects = await client.fetchCalendarObjects({ calendar })
      return objects.flatMap(({ url, etag, data }) => {
        if (typeof data !== 'string') return []
        const event = parseEvent(data, timeZone)
        return event ? [{ ...event, calendarUrl: calendar.url, url, etag, ics: data }] : []
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
    await client.updateCalendarObject({
      calendarObject: { url, etag, data: patchEvent(ics, values, timeZone) },
    })
    return
  }

  const calendar = calendars.find(({ url }) => url === values.calendarUrl)
  if (!calendar) throw new Error(`Unknown calendar: ${values.calendarUrl}`)
  await client.createCalendarObject({
    calendar,
    filename: `${crypto.randomUUID()}.ics`,
    iCalString: existing
      ? patchEvent(existing.ics, values, timeZone)
      : buildEvent(values, crypto.randomUUID(), timeZone),
  })
  if (existing) {
    await client.deleteCalendarObject({
      calendarObject: { url: existing.url, etag: existing.etag },
    })
  }
}
