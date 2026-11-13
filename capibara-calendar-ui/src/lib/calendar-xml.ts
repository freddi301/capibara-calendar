const ns =
  'xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:ic="http://apple.com/ns/ical/"'

export function escapeXml(text: string) {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;')
}

type CalendarProps = { name: string; color: string }

const name = (value: string) => `<d:displayname>${escapeXml(value)}</d:displayname>`
const color = (value: string) =>
  `<ic:calendar-color>${escapeXml(value.toUpperCase())}</ic:calendar-color>`

const props = (values: CalendarProps) =>
  name(values.name) + (values.color ? color(values.color) : '')

export function mkcalendarBody(values: CalendarProps) {
  return `<?xml version="1.0" encoding="utf-8"?><c:mkcalendar ${ns}><d:set><d:prop>${props(values)}<c:supported-calendar-component-set><c:comp name="VEVENT"/></c:supported-calendar-component-set></d:prop></d:set></c:mkcalendar>`
}

export function proppatchBody(values: CalendarProps) {
  return `<?xml version="1.0" encoding="utf-8"?><d:propertyupdate ${ns}><d:set><d:prop>${props(values)}</d:prop></d:set>${values.color ? '' : '<d:remove><d:prop><ic:calendar-color/></d:prop></d:remove>'}</d:propertyupdate>`
}

export function failedStatus(multistatus: string) {
  for (const [, code] of multistatus.matchAll(/<(?:\w+:)?status>\s*HTTP\/\S+\s+(\d{3})/gi)) {
    if (Number(code) >= 400) return Number(code)
  }
  return undefined
}
