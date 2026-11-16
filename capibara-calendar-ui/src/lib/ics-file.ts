import ICAL from 'ical.js'
import { decode } from '@/api/caldav/codec'
import { hasRules, matches, type Group } from './event-filter'

const prodId = '-//capibara-calendar-ui//EN'
const yearsAhead = 10

function read(ics: string): ICAL.Component | undefined {
  try {
    return new ICAL.Component(ICAL.parse(ics) as unknown[])
  } catch {
    return undefined // a part that cannot be read is not in the file
  }
}

const eventsIn = (ics: string) => read(ics)?.getAllSubcomponents('vevent') ?? []

export function countEvents(parts: string[]) {
  let events = 0
  let series = 0
  let occurrences = 0
  for (const part of parts) {
    for (const vevent of eventsIn(part)) {
      if (vevent.hasProperty('recurrence-id')) occurrences += 1
      else {
        events += 1
        if (vevent.hasProperty('rrule')) series += 1
      }
    }
  }
  return { events, series, occurrences }
}

export function splitByFilter(parts: string[], rules: Group) {
  if (!hasRules(rules)) return { included: parts, left: [] as string[] }
  const included: string[] = []
  const left: string[] = []
  for (const part of parts) {
    const resource = decode(part)
    ;(resource && matches(rules, resource.event) ? included : left).push(part)
  }
  return { included, left }
}

const pad = (value: number) => String(value).padStart(2, '0')

function offsetText(nanoseconds: number) {
  const seconds = Math.abs(Math.round(nanoseconds / 1e9))
  const rest = seconds % 60
  const clock = `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor((seconds % 3600) / 60))}`
  return `${nanoseconds < 0 ? '-' : '+'}${clock}${rest ? `:${pad(rest)}` : ''}`
}

function timeZoneOf(tzid: string, from: number, to: number) {
  const zone = new ICAL.Component('vtimezone')
  zone.addPropertyWithValue('tzid', tzid)
  const start = Temporal.ZonedDateTime.from({ year: from, month: 1, day: 1, timeZone: tzid })
  const changes: Temporal.ZonedDateTime[] = []
  for (
    let next = start.getTimeZoneTransition('next');
    next && next.year <= to;
    next = next.getTimeZoneTransition('next')
  ) {
    changes.push(next)
  }
  const standard = Math.min(
    ...[start, ...changes].map(({ offsetNanoseconds }) => offsetNanoseconds),
  )
  const add = (at: Temporal.ZonedDateTime, before: number) => {
    const part = new ICAL.Component(at.offsetNanoseconds > standard ? 'daylight' : 'standard')
    // The moment is told in the time of the offset before it.
    const local = Temporal.Instant.fromEpochNanoseconds(at.epochNanoseconds)
      .toZonedDateTimeISO(offsetText(before))
      .toPlainDateTime()
    part.addPropertyWithValue(
      'dtstart',
      ICAL.Time.fromData({
        year: local.year,
        month: local.month,
        day: local.day,
        hour: local.hour,
        minute: local.minute,
        second: local.second,
      }),
    )
    part.addPropertyWithValue('tzoffsetfrom', ICAL.UtcOffset.fromSeconds(before / 1e9))
    part.addPropertyWithValue('tzoffsetto', ICAL.UtcOffset.fromSeconds(at.offsetNanoseconds / 1e9))
    zone.addSubcomponent(part)
  }
  add(start, start.offsetNanoseconds)
  changes.forEach((change, index) => {
    add(change, (index === 0 ? start : changes[index - 1]).offsetNanoseconds)
  })
  return zone
}

function yearsOf(vevent: ICAL.Component) {
  const years = new Map<string, number[]>()
  for (const property of vevent.getAllProperties()) {
    const tzid = property.getParameter('tzid')
    const value = property.getFirstValue()
    if (typeof tzid !== 'string' || !(value instanceof ICAL.Time)) continue
    years.set(tzid, [...(years.get(tzid) ?? []), value.year])
  }
  return years
}

export function icsFileName(calendarName: string) {
  const name = calendarName
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
  return `${name || 'calendar'}.ics`
}

export function buildCalendarFile(calendarName: string, parts: string[]) {
  const calendar = new ICAL.Component('vcalendar')
  calendar.addPropertyWithValue('version', '2.0')
  calendar.addPropertyWithValue('prodid', prodId)
  calendar.addPropertyWithValue('calscale', 'GREGORIAN')
  calendar.addPropertyWithValue('x-wr-calname', calendarName)

  const zones = new Map<string, ICAL.Component>()
  const events: ICAL.Component[] = []
  const years = new Map<string, number[]>()
  for (const part of parts) {
    const source = read(part)
    if (!source) continue
    for (const zone of source.getAllSubcomponents('vtimezone')) {
      zones.set(String(zone.getFirstPropertyValue('tzid')), zone)
    }
    for (const vevent of source.getAllSubcomponents('vevent')) {
      events.push(vevent)
      for (const [tzid, used] of yearsOf(vevent))
        years.set(tzid, [...(years.get(tzid) ?? []), ...used])
    }
  }
  const thisYear = Temporal.Now.plainDateISO().year
  for (const [tzid, used] of years) {
    if (zones.has(tzid)) continue
    try {
      zones.set(
        tzid,
        timeZoneOf(
          tzid,
          Math.min(...used) - 1,
          Math.max(Math.max(...used), thisYear + yearsAhead) + 1,
        ),
      )
    } catch {
      // A name that is not one of the zones that are known stays as it is.
    }
  }
  for (const zone of zones.values()) calendar.addSubcomponent(zone)
  for (const vevent of events) calendar.addSubcomponent(vevent)
  return `${calendar.toString()}\r\n`
}
