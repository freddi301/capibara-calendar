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
