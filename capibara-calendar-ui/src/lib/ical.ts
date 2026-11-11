import ICAL from 'ical.js'
import { eventKind, type EventFields } from './event-schema'
import type { DateRange } from './week'

function readCalendar(ics: string) {
  const jcal: unknown = ICAL.parse(ics)
  if (!Array.isArray(jcal)) throw new Error('Not iCalendar')
  return new ICAL.Component(jcal)
}

function localParts(time: ICAL.Time, tzid: unknown, timeZone: string) {
  if (time.isDate) return { date: time.toString(), time: '' }

  let local = Temporal.PlainDateTime.from({
    year: time.year,
    month: time.month,
    day: time.day,
    hour: time.hour,
    minute: time.minute,
  })
  const zone = typeof tzid === 'string' ? tzid : time.zone.tzid === 'UTC' ? 'UTC' : undefined
  if (zone) {
    try {
      local = local.toZonedDateTime(zone).withTimeZone(timeZone).toPlainDateTime()
    } catch {
      // Unknown time zone name: keep the time as written.
    }
  }
  return {
    date: local.toPlainDate().toString(),
    time: local.toPlainTime().toString({ smallestUnit: 'minute' }),
  }
}

function toLocal(property: ICAL.Property, timeZone: string) {
  const time = property.getFirstValue()
  if (!(time instanceof ICAL.Time)) throw new Error('Not a date')
  return localParts(time, property.getParameter('tzid'), timeZone)
}

function masterOf(calendar: ICAL.Component) {
  const events = calendar.getAllSubcomponents('vevent')
  return events.find((vevent) => !vevent.hasProperty('recurrence-id')) ?? events.at(0)
}

const text = (vevent: ICAL.Component, name: string) => {
  const value = vevent.getFirstPropertyValue(name)
  return typeof value === 'string' ? value : ''
}

function lastDay(exclusiveEnd: string, start: string) {
  const last = Temporal.PlainDate.from(exclusiveEnd).subtract({ days: 1 }).toString()
  return last > start ? last : ''
}

export type ParsedEvent = EventFields & { uid: string; isRecurring?: boolean }

export function parseEvent(ics: string, timeZone: string): ParsedEvent | undefined {
  try {
    const vevent = masterOf(readCalendar(ics))
    const start = vevent?.getFirstProperty('dtstart')
    if (!vevent || !start) return undefined

    const startAt = toLocal(start, timeZone)
    const end = vevent.getFirstProperty('dtend')
    let endDate = ''
    let endTime = ''
    if (end && startAt.time) {
      ;({ date: endDate, time: endTime } = toLocal(end, timeZone))
    } else if (end) {
      endDate = lastDay(toLocal(end, timeZone).date, startAt.date)
    }
    return {
      uid: text(vevent, 'uid'),
      title: text(vevent, 'summary'),
      description: text(vevent, 'description'),
      startDate: startAt.date,
      startTime: startAt.time,
      endDate,
      endTime,
    }
  } catch {
    return undefined // not valid iCalendar
  }
}

const maxOccurrences = 10000

export function parseEvents(ics: string, timeZone: string, range: DateRange): ParsedEvent[] {
  try {
    const calendar = readCalendar(ics)
    const master = masterOf(calendar)
    if (!master?.hasProperty('dtstart')) return []
    const event = new ICAL.Event(master)
    if (!event.isRecurring()) {
      const single = parseEvent(ics, timeZone)
      return single ? [single] : []
    }
    for (const vevent of calendar.getAllSubcomponents('vevent')) {
      if (vevent.hasProperty('recurrence-id')) event.relateException(vevent)
    }

    const found: ParsedEvent[] = []
    const hasEnd = master.hasProperty('dtend') || master.hasProperty('duration')
    const iterator = event.iterator()
    for (let count = 0; count < maxOccurrences; count++) {
      const next = iterator.next() as ICAL.Time | undefined // none at the end of the repeat
      if (!next) break
      const details = event.getOccurrenceDetails(next)
      const item = details.item.component
      const tzid = (prop: string) => item.getFirstProperty(prop)?.getParameter('tzid')
      const startAt = localParts(details.startDate, tzid('dtstart'), timeZone)
      if (startAt.date > range.end) break

      let endDate = ''
      let endTime = ''
      if (hasEnd && startAt.time) {
        ;({ date: endDate, time: endTime } = localParts(
          details.endDate,
          tzid('dtend') ?? tzid('dtstart'),
          timeZone,
        ))
      } else if (hasEnd) {
        endDate = lastDay(details.endDate.toString(), startAt.date)
      }
      if ((endDate || startAt.date) < range.start) continue

      found.push({
        uid: text(item, 'uid'),
        title: text(item, 'summary'),
        description: text(item, 'description'),
        startDate: startAt.date,
        startTime: startAt.time,
        endDate,
        endTime,
        isRecurring: true,
      })
    }
    return found
  } catch {
    return [] // not valid iCalendar
  }
}

const toUtc = (date: string, time: string, timeZone: string) =>
  ICAL.Time.fromDateTimeString(
    Temporal.PlainDateTime.from(`${date}T${time}`).toZonedDateTime(timeZone).toInstant().toString(),
  )

function applyFields(vevent: ICAL.Component, fields: EventFields, timeZone: string) {
  vevent.updatePropertyWithValue('summary', fields.title)
  vevent.removeAllProperties('description')
  if (fields.description) vevent.addPropertyWithValue('description', fields.description)

  for (const name of ['dtstart', 'dtend', 'duration']) vevent.removeAllProperties(name)
  const kind = eventKind(fields)
  if (kind === 'allDay') {
    vevent.addPropertyWithValue('dtstart', ICAL.Time.fromDateString(fields.startDate))
    if (fields.endDate > fields.startDate) {
      const exclusive = Temporal.PlainDate.from(fields.endDate).add({ days: 1 }).toString()
      vevent.addPropertyWithValue('dtend', ICAL.Time.fromDateString(exclusive))
    }
  } else {
    vevent.addPropertyWithValue('dtstart', toUtc(fields.startDate, fields.startTime, timeZone))
    if (kind === 'startEnd') {
      vevent.addPropertyWithValue(
        'dtend',
        toUtc(fields.endDate || fields.startDate, fields.endTime, timeZone),
      )
    }
  }
}

export function buildEvent(fields: EventFields, uid: string, timeZone: string) {
  const calendar = new ICAL.Component('vcalendar')
  calendar.addPropertyWithValue('version', '2.0')
  calendar.addPropertyWithValue('prodid', '-//capibara-calendar-ui//EN')
  const vevent = new ICAL.Component('vevent')
  vevent.addPropertyWithValue('uid', uid)
  vevent.addPropertyWithValue('dtstamp', ICAL.Time.now())
  applyFields(vevent, fields, timeZone)
  calendar.addSubcomponent(vevent)
  return calendar.toString()
}

export function patchEvent(ics: string, fields: EventFields, timeZone: string) {
  const calendar = readCalendar(ics)
  const vevent = masterOf(calendar)
  if (!vevent) throw new Error('Not an event')
  applyFields(vevent, fields, timeZone)
  return calendar.toString()
}
