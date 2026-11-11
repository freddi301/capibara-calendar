import type { APIRequestContext } from '@playwright/test'

const headers = {
  // The local Radicale accepts any login.
  Authorization: `Basic ${Buffer.from('dev:dev').toString('base64')}`,
  'Content-Type': 'application/xml',
}

/** Creates a calendar on the real CalDAV server. Does nothing if it already exists. */
export async function ensureCalendar(request: APIRequestContext, slug: string, name: string) {
  await request.fetch(`/radicale/dev/${slug}/`, {
    method: 'MKCALENDAR',
    headers,
    data: `<C:mkcalendar xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:caldav">
      <D:set><D:prop>
        <D:displayname>${name}</D:displayname>
        <C:supported-calendar-component-set><C:comp name="VEVENT"/></C:supported-calendar-component-set>
      </D:prop></D:set>
    </C:mkcalendar>`,
  })
}

const calendarHeaders = {
  Authorization: headers.Authorization,
  'Content-Type': 'text/calendar; charset=utf-8',
}

export type PutEvent = { slug: string; uid: string; title: string; lines: string[] }

/** The date of today on this computer, as the date of an iCalendar object: YYYYMMDD. */
export function icsDay(offset = 0) {
  const day = new Date()
  day.setDate(day.getDate() + offset)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${day.getFullYear()}${pad(day.getMonth() + 1)}${pad(day.getDate())}`
}

/** Puts an event on the real CalDAV server, as another app would. */
export async function putEvent(request: APIRequestContext, { slug, uid, title, lines }: PutEvent) {
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//e2e//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    'DTSTAMP:20260101T000000Z',
    `SUMMARY:${title}`,
    ...lines,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
  const response = await request.fetch(`/radicale/dev/${slug}/${uid}.ics`, {
    method: 'PUT',
    headers: calendarHeaders,
    data: ics,
  })
  if (!response.ok()) throw new Error(`Cannot put the event: ${response.status()}`)
}

export async function removeEvent(request: APIRequestContext, slug: string, uid: string) {
  await request.fetch(`/radicale/dev/${slug}/${uid}.ics`, {
    method: 'DELETE',
    headers: { Authorization: headers.Authorization },
  })
}
