import ICAL from 'ical.js'
import { eventKind, type EventFields } from './event-schema'

function readCalendar(ics: string) {
  const jcal: unknown = ICAL.parse(ics)
  if (!Array.isArray(jcal)) throw new Error('Not iCalendar')
  return new ICAL.Component(jcal)
}

function toLocal(property: ICAL.Property, timeZone: string) {
  const time = property.getFirstValue()
  if (!(time instanceof ICAL.Time)) throw new Error('Not a date')
  if (time.isDate) return { date: time.toString(), time: '' }

  let local = Temporal.PlainDateTime.from({
    year: time.year,
    month: time.month,
    day: time.day,
    hour: time.hour,
    minute: time.minute,
  })
  const tzid = property.getParameter('tzid')
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

export function parseEvent(
  ics: string,
  timeZone: string,
): (EventFields & { uid: string }) | undefined {
  try {
    const vevent = readCalendar(ics).getFirstSubcomponent('vevent')
    const start = vevent?.getFirstProperty('dtstart')
    if (!vevent || !start) return undefined

    const startAt = toLocal(start, timeZone)
    const end = vevent.getFirstProperty('dtend')
    let endDate = ''
    let endTime = ''
    if (end && startAt.time) {
      ;({ date: endDate, time: endTime } = toLocal(end, timeZone))
    } else if (end) {
      // A DATE end is exclusive; the form shows the last day.
      const last = Temporal.PlainDate.from(toLocal(end, timeZone).date)
        .subtract({ days: 1 })
        .toString()
      if (last > startAt.date) endDate = last
    }
    const text = (name: string) => {
      const value = vevent.getFirstPropertyValue(name)
      return typeof value === 'string' ? value : ''
    }
    return {
      uid: text('uid'),
      title: text('summary'),
      description: text('description'),
      startDate: startAt.date,
      startTime: startAt.time,
      endDate,
      endTime,
    }
  } catch {
    return undefined // not valid iCalendar
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
  const vevent = calendar.getFirstSubcomponent('vevent')
  if (!vevent) throw new Error('Not an event')
  applyFields(vevent, fields, timeZone)
  return calendar.toString()
}
