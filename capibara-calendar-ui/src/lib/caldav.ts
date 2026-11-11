import { createDAVClient } from 'tsdav'

export type CalendarEvent = { uid: string; title: string; date: string }

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
  let calendars = await client.fetchCalendars({ account })
  if (!calendars.length) {
    await client.makeCalendar({
      url: new URL('calendar/', account.homeUrl).href,
      props: {
        displayname: 'Calendar',
        supportedCalendarComponentSet: { comp: { _attributes: { name: 'VEVENT' } } },
      },
    })
    calendars = await client.fetchCalendars({ account })
  }
  return { client, calendar: calendars[0] }
}

let connection: ReturnType<typeof connect> | undefined
function getConnection() {
  connection ??= connect().catch((error: unknown) => {
    connection = undefined // retry from scratch next time
    throw error
  })
  return connection
}

const escapeText = (text: string) => text.replace(/[\\;,]/g, '\\$&').replace(/\r?\n/g, '\\n')
const unescapeText = (text: string) =>
  text.replace(/\\([\\;,nN])/g, (_, char: string) => (char.toLowerCase() === 'n' ? '\n' : char))

const property = (ics: string, name: string) =>
  ics
    .replace(/\r?\n[ \t]/g, '')
    .match(new RegExp(`^${name}(?:;[^:\\r\\n]*)?:(.*)$`, 'm'))?.[1]
    .trim()

export async function listEvents(): Promise<CalendarEvent[]> {
  const { client, calendar } = await getConnection()
  const objects = await client.fetchCalendarObjects({ calendar })
  return objects
    .map(({ data }): CalendarEvent | undefined => {
      if (typeof data !== 'string') return undefined
      const start = property(data, 'DTSTART')
      if (!start) return undefined
      return {
        uid: property(data, 'UID') ?? start,
        title: unescapeText(property(data, 'SUMMARY') ?? ''),
        date: `${start.slice(0, 4)}-${start.slice(4, 6)}-${start.slice(6, 8)}`,
      }
    })
    .filter((event) => event !== undefined)
    .sort((a, b) => a.date.localeCompare(b.date))
}

export async function createEvent({ title, date }: { title: string; date: string }) {
  const { client, calendar } = await getConnection()
  const uid = crypto.randomUUID()
  const iCalString = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//capibara-calendar-ui//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${new Date().toISOString().replace(/[-:]|\.\d{3}/g, '')}`,
    `DTSTART;VALUE=DATE:${date.replaceAll('-', '')}`,
    `SUMMARY:${escapeText(title)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
  await client.createCalendarObject({ calendar, filename: `${uid}.ics`, iCalString })
}
