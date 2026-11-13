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

export async function setCalendarColor(
  request: APIRequestContext,
  slug: string,
  color: string | undefined,
) {
  const change = color
    ? `<D:set><D:prop><IC:calendar-color>${color}</IC:calendar-color></D:prop></D:set>`
    : '<D:remove><D:prop><IC:calendar-color/></D:prop></D:remove>'
  const response = await request.fetch(`/radicale/dev/${slug}/`, {
    method: 'PROPPATCH',
    headers,
    data: `<D:propertyupdate xmlns:D="DAV:" xmlns:IC="http://apple.com/ns/ical/">${change}</D:propertyupdate>`,
  })
  if (!response.ok()) throw new Error(`Cannot set the colour: ${response.status()}`)
}

/** The people that the tests invite: in the address book of the real server, with an id that does not change. */
export const contacts = {
  ada: { name: 'Ada Test', id: 'urn:uuid:e2e00000-0000-4000-8000-00000000ada1' },
  bruno: { name: 'Bruno Test', id: 'urn:uuid:e2e00000-0000-4000-8000-0000000bb001' },
}

/** Makes the address book of the tests, and the contacts in it. Does nothing to what is there already. */
export async function ensureContacts(request: APIRequestContext) {
  await request.fetch('/radicale/dev/contacts/', {
    method: 'MKCOL',
    headers,
    data: `<D:mkcol xmlns:D="DAV:" xmlns:C="urn:ietf:params:xml:ns:carddav"><D:set><D:prop>
      <D:resourcetype><D:collection/><C:addressbook/></D:resourcetype>
      <D:displayname>Contacts</D:displayname>
    </D:prop></D:set></D:mkcol>`,
  })
  for (const { name, id } of Object.values(contacts)) {
    const response = await request.fetch(
      `/radicale/dev/contacts/${id.replace('urn:uuid:', '')}.vcf`,
      {
        method: 'PUT',
        headers: {
          Authorization: headers.Authorization,
          'Content-Type': 'text/vcard; charset=utf-8',
        },
        data: `BEGIN:VCARD\r\nVERSION:4.0\r\nFN:${name}\r\nUID:${id}\r\nEND:VCARD\r\n`,
      },
    )
    if (!response.ok()) throw new Error(`Cannot put the contact: ${response.status()}`)
  }
}

/** The text of the event that has this title on the server, the lines unfolded, and where it is. */
export async function findEvent(request: APIRequestContext, slug: string, title: string) {
  const list = await request.fetch(`/radicale/dev/${slug}/`, {
    method: 'PROPFIND',
    headers: { ...headers, Depth: '1' },
    data: '<D:propfind xmlns:D="DAV:"><D:prop><D:getetag/></D:prop></D:propfind>',
  })
  const hrefs = [
    ...(await list.text()).matchAll(/>(\/radicale\/dev\/[^<]+\.ics|\/dev\/[^<]+\.ics)</g),
  ].map((match) => match[1])
  for (const href of hrefs) {
    const response = await request.fetch(href.startsWith('/radicale') ? href : `/radicale${href}`, {
      headers: { Authorization: headers.Authorization },
    })
    const ics = (await response.text()).replace(/\r?\n[ \t]/g, '')
    if (ics.includes(`SUMMARY:${title}`)) {
      return { href: href.startsWith('/radicale') ? href : `/radicale${href}`, ics }
    }
  }
  return undefined
}

export async function removeFound(request: APIRequestContext, slug: string, title: string) {
  const found = await findEvent(request, slug, title)
  if (found)
    await request.fetch(found.href, {
      method: 'DELETE',
      headers: { Authorization: headers.Authorization },
    })
}
