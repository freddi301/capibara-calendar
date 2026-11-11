import ICAL from 'ical.js'
import { splitTags } from './tags'
import {
  eventKind,
  reminders,
  visibilities,
  weekdayCodes,
  type EventFields,
  type Repeat,
  type Reminder,
  type Visibility,
} from './event-schema'
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

export type ParsedEvent = EventFields & {
  uid: string
  isRecurring?: boolean
  occurrenceId?: string
}

function reminderOf(vevent: ICAL.Component): Reminder {
  const alarms = vevent.getAllSubcomponents('valarm')
  if (!alarms.length) return ''
  if (alarms.length > 1) return 'custom' // more than the form shows: they are left as they are
  const trigger = alarms[0].getFirstProperty('trigger')
  const duration = trigger?.getFirstValue()
  if (!(duration instanceof ICAL.Duration) || trigger?.getParameter('related') === 'END') {
    return 'custom'
  }
  const minutes = String(-duration.toSeconds() / 60)
  return reminders.find((reminder) => reminder === minutes) ?? 'custom'
}

const conferenceOf = (vevent: ICAL.Component) =>
  text(vevent, 'conference') || text(vevent, 'x-google-conference')

function detailsOf(vevent: ICAL.Component) {
  const visibility = text(vevent, 'class').toLowerCase()
  return {
    location: text(vevent, 'location'),
    reminder: reminderOf(vevent),
    tags: vevent
      .getAllProperties('categories')
      .flatMap((property) => property.getValues().map(String))
      .join(', '),
    showAs:
      text(vevent, 'transp').toUpperCase() === 'TRANSPARENT'
        ? ('free' as const)
        : ('busy' as const),
    visibility:
      visibilities.find((value) => value && value === visibility) ?? ('' satisfies Visibility),
    videoLink: conferenceOf(vevent),
  }
}

const simpleRepeats: Repeat[] = ['DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY']

function repeatOf(vevent: ICAL.Component, timeZone: string) {
  const rule = vevent.getFirstPropertyValue('rrule')
  if (!(rule instanceof ICAL.Recur)) return {}
  const days: string[] | undefined = rule.parts.BYDAY
  const others = Object.keys(rule.parts).filter((part) => part !== 'BYDAY')
  const isSimple =
    simpleRepeats.includes(rule.freq as Repeat) &&
    others.length === 0 &&
    (!days ||
      (rule.freq === 'WEEKLY' && days.every((day) => weekdayCodes.some((code) => code === day)))) &&
    !(rule.count && rule.until)
  return {
    repeat: isSimple ? (rule.freq as Repeat) : ('custom' as const),
    repeatUntil: rule.until ? localParts(rule.until, undefined, timeZone).date : '',
    repeatInterval: String(rule.interval),
    repeatDays: isSimple && days ? days : [],
    repeatCount: rule.count ? String(rule.count) : '',
    repeatEnds: rule.count ? ('after' as const) : rule.until ? ('on' as const) : ('never' as const),
  }
}

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
      ...repeatOf(vevent, timeZone),
      ...detailsOf(vevent),
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
      const next = iterator.next() as ICAL.Time | undefined
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
        occurrenceId: details.recurrenceId.toICALString(),
        ...detailsOf(item),
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

function applyDetails(vevent: ICAL.Component, fields: EventFields) {
  if (fields.location !== undefined) {
    vevent.removeAllProperties('location')
    if (fields.location.trim()) vevent.addPropertyWithValue('location', fields.location.trim())
  }
  if (fields.tags !== undefined) {
    vevent.removeAllProperties('categories')
    const tags = splitTags(fields.tags)
    if (tags.length) vevent.addProperty(new ICAL.Property(['categories', {}, 'text', ...tags]))
  }
  if (fields.showAs !== undefined) {
    vevent.removeAllProperties('transp')
    if (fields.showAs === 'free') vevent.addPropertyWithValue('transp', 'TRANSPARENT')
  }
  if (fields.visibility !== undefined) {
    vevent.removeAllProperties('class')
    if (fields.visibility) vevent.addPropertyWithValue('class', fields.visibility.toUpperCase())
  }
  if (fields.videoLink !== undefined && fields.videoLink !== conferenceOf(vevent)) {
    for (const name of ['conference', 'x-google-conference']) vevent.removeAllProperties(name)
    if (fields.videoLink) {
      vevent.addProperty(
        new ICAL.Property([
          'conference',
          { value: 'URI', feature: 'VIDEO' },
          'uri',
          fields.videoLink,
        ]),
      )
    }
  }
  const minutes = Number(fields.reminder)
  if (fields.reminder !== undefined && fields.reminder !== 'custom') {
    for (const alarm of vevent.getAllSubcomponents('valarm')) vevent.removeSubcomponent(alarm)
    if (fields.reminder !== '') {
      const alarm = new ICAL.Component('valarm')
      alarm.addPropertyWithValue('action', 'DISPLAY')
      alarm.addPropertyWithValue('description', fields.title)
      alarm.addPropertyWithValue('trigger', ICAL.Duration.fromSeconds(-minutes * 60))
      vevent.addSubcomponent(alarm)
    }
  }
}

function applyRepeat(vevent: ICAL.Component, fields: EventFields, timeZone: string) {
  if (fields.repeat === undefined || fields.repeat === 'custom') return
  vevent.removeAllProperties('rrule')
  if (!fields.repeat) {
    for (const name of ['exdate', 'rdate']) vevent.removeAllProperties(name)
    return
  }
  const { repeatUntil, startTime } = fields
  // How it ends: what was said, or the day when only the day is there, as the repeat was before.
  const ends = fields.repeatEnds ?? (repeatUntil ? 'on' : 'never')
  const until =
    ends !== 'on' || !repeatUntil
      ? undefined
      : startTime
        ? toUtc(repeatUntil, '23:59:59', timeZone) // the last day, to its end
        : ICAL.Time.fromDateString(repeatUntil)
  const count = ends === 'after' ? Number(fields.repeatCount) : 0
  const interval = Number(fields.repeatInterval ?? 1)
  const days = fields.repeat === 'WEEKLY' ? (fields.repeatDays ?? []) : []
  vevent.addPropertyWithValue(
    'rrule',
    new ICAL.Recur({
      freq: fields.repeat,
      ...(interval > 1 ? { interval } : {}),
      ...(until ? { until } : {}),
      ...(count > 0 ? { count } : {}),
      ...(days.length ? { parts: { BYDAY: days } } : {}),
    }),
  )
}

export function buildEvent(fields: EventFields, uid: string, timeZone: string) {
  const calendar = new ICAL.Component('vcalendar')
  calendar.addPropertyWithValue('version', '2.0')
  calendar.addPropertyWithValue('prodid', '-//capibara-calendar-ui//EN')
  const vevent = new ICAL.Component('vevent')
  vevent.addPropertyWithValue('uid', uid)
  vevent.addPropertyWithValue('dtstamp', ICAL.Time.now())
  applyFields(vevent, fields, timeZone)
  applyDetails(vevent, fields)
  applyRepeat(vevent, fields, timeZone)
  calendar.addSubcomponent(vevent)
  return calendar.toString()
}

export function patchEvent(ics: string, fields: EventFields, timeZone: string) {
  const calendar = readCalendar(ics)
  const vevent = masterOf(calendar)
  if (!vevent) throw new Error('Not an event')
  applyFields(vevent, fields, timeZone)
  applyDetails(vevent, fields)
  applyRepeat(vevent, fields, timeZone)
  if (fields.repeat === '') removeChanges(calendar) // it does not repeat any more: nothing to change
  return calendar.toString()
}

const isChange = (vevent: ICAL.Component) => vevent.hasProperty('recurrence-id')

function removeChanges(calendar: ICAL.Component) {
  for (const vevent of calendar.getAllSubcomponents('vevent')) {
    if (isChange(vevent)) calendar.removeSubcomponent(vevent)
  }
}

function timeOf(occurrenceId: string) {
  const match = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(occurrenceId)
  if (!match) throw new Error(`Not a time: ${occurrenceId}`)
  const parts = match.slice(1, 7) as (string | undefined)[]
  const [year, month, day, hour, minute, second] = parts.map((part) => Number(part ?? 0))
  const isDate = !match[4]
  const time = ICAL.Time.fromData({ year, month, day, hour, minute, second, isDate })
  if (match[7]) time.zone = ICAL.Timezone.utcTimezone
  return time
}

function occurrenceProperty(master: ICAL.Component, name: string, occurrenceId: string) {
  const property = new ICAL.Property(name)
  property.setValue(timeOf(occurrenceId))
  const tzid = master.getFirstProperty('dtstart')?.getParameter('tzid')
  if (typeof tzid === 'string') property.setParameter('tzid', tzid)
  return property
}

function removeChangeOf(calendar: ICAL.Component, occurrenceId: string) {
  for (const vevent of calendar.getAllSubcomponents('vevent')) {
    const id = vevent.getFirstPropertyValue('recurrence-id')
    if (id instanceof ICAL.Time && id.toICALString() === occurrenceId) {
      calendar.removeSubcomponent(vevent)
    }
  }
}

export function patchOccurrence(
  ics: string,
  occurrenceId: string,
  fields: EventFields,
  timeZone: string,
) {
  const calendar = readCalendar(ics)
  const master = masterOf(calendar)
  if (!master) throw new Error('Not an event')
  removeChangeOf(calendar, occurrenceId)

  const change = new ICAL.Component('vevent')
  change.addPropertyWithValue('uid', text(master, 'uid'))
  change.addPropertyWithValue('dtstamp', ICAL.Time.now())
  change.addProperty(occurrenceProperty(master, 'recurrence-id', occurrenceId))
  applyFields(change, fields, timeZone)
  applyDetails(change, fields)
  calendar.addSubcomponent(change)
  return calendar.toString()
}

export function excludeOccurrence(ics: string, occurrenceId: string) {
  const calendar = readCalendar(ics)
  const master = masterOf(calendar)
  if (!master) throw new Error('Not an event')
  removeChangeOf(calendar, occurrenceId)
  master.addProperty(occurrenceProperty(master, 'exdate', occurrenceId))
  return calendar.toString()
}

const stampOf = (time: ICAL.Time) =>
  Date.UTC(time.year, time.month - 1, time.day, time.hour, time.minute, time.second)

function occurrencesBefore(master: ICAL.Component, from: ICAL.Time) {
  const rule = master.getFirstPropertyValue('rrule')
  const start = master.getFirstPropertyValue('dtstart')
  if (!(rule instanceof ICAL.Recur) || !(start instanceof ICAL.Time)) return 0
  const iterator = rule.iterator(start)
  let before = 0
  for (let count = 0; count < maxOccurrences; count++) {
    const next = iterator.next() as ICAL.Time | undefined // none at the end of the repeat
    if (!next || stampOf(next) >= stampOf(from)) break
    before++
  }
  return before
}

export function repeatFrom(ics: string, occurrenceId: string, timeZone: string) {
  const master = masterOf(readCalendar(ics))
  if (!master) throw new Error('Not an event')
  const repeat = repeatOf(master, timeZone)
  const rule = master.getFirstPropertyValue('rrule')
  const before = occurrencesBefore(master, timeOf(occurrenceId))
  return {
    ...repeat,
    ...(rule instanceof ICAL.Recur && rule.count
      ? { repeatCount: String(Math.max(rule.count - before, 1)) }
      : {}),
  }
}

function endBefore(master: ICAL.Component, from: ICAL.Time) {
  const start = master.getFirstPropertyValue('dtstart')
  if (start instanceof ICAL.Time && start.isDate) {
    const day = from.clone()
    day.adjust(-1, 0, 0, 0)
    return day
  }
  const tzid = master.getFirstProperty('dtstart')?.getParameter('tzid')
  const local = Temporal.PlainDateTime.from({
    year: from.year,
    month: from.month,
    day: from.day,
    hour: from.hour,
    minute: from.minute,
    second: from.second,
  })
  if (typeof tzid === 'string') {
    try {
      const instant = local.toZonedDateTime(tzid).subtract({ seconds: 1 }).toInstant().toString()
      return ICAL.Time.fromDateTimeString(instant)
    } catch {
      // Unknown time zone name: as it is written.
    }
  }
  const before = ICAL.Time.fromDateTimeString(local.subtract({ seconds: 1 }).toString())
  if (from.zone === ICAL.Timezone.utcTimezone) before.zone = ICAL.Timezone.utcTimezone
  return before
}

function keepExceptions(calendar: ICAL.Component, isKept: (time: ICAL.Time) => boolean) {
  for (const vevent of calendar.getAllSubcomponents('vevent')) {
    const id = vevent.getFirstPropertyValue('recurrence-id')
    if (id instanceof ICAL.Time && !isKept(id)) calendar.removeSubcomponent(vevent)
  }
  const master = masterOf(calendar)
  for (const property of master?.getAllProperties('exdate') ?? []) {
    const kept = property.getValues().filter((value) => isKept(value as ICAL.Time))
    master?.removeProperty(property)
    for (const value of kept) {
      const again = new ICAL.Property('exdate')
      again.setValue(value as ICAL.Time)
      const tzid = property.getParameter('tzid')
      if (typeof tzid === 'string') again.setParameter('tzid', tzid)
      master?.addProperty(again)
    }
  }
}

export function endSeriesBefore(ics: string, occurrenceId: string) {
  const calendar = readCalendar(ics)
  const master = masterOf(calendar)
  const rule = master?.getFirstPropertyValue('rrule')
  if (!master || !(rule instanceof ICAL.Recur)) return undefined
  const from = timeOf(occurrenceId)
  if (occurrencesBefore(master, from) === 0) return undefined

  keepExceptions(calendar, (time) => stampOf(time) < stampOf(from))
  const ended = new ICAL.Recur({
    freq: rule.freq,
    ...(rule.interval > 1 ? { interval: rule.interval } : {}),
    until: endBefore(master, from),
  })
  Object.assign(ended.parts, rule.parts)
  master.removeAllProperties('rrule')
  master.addPropertyWithValue('rrule', ended)
  return calendar.toString()
}

export function splitSeries(
  ics: string,
  occurrenceId: string,
  fields: EventFields,
  timeZone: string,
  newUid: string,
  hasSameDays: boolean,
) {
  const original = endSeriesBefore(ics, occurrenceId)
  if (!original) return undefined

  const calendar = readCalendar(ics)
  const master = masterOf(calendar)
  if (!master) throw new Error('Not an event')
  const from = timeOf(occurrenceId)
  keepExceptions(calendar, (time) => hasSameDays && stampOf(time) >= stampOf(from))
  for (const vevent of calendar.getAllSubcomponents('vevent')) {
    vevent.updatePropertyWithValue('uid', newUid)
  }
  applyFields(master, fields, timeZone)
  applyDetails(master, fields)
  applyRepeat(master, fields, timeZone)
  master.updatePropertyWithValue('dtstamp', ICAL.Time.now())
  return { original, following: calendar.toString() }
}
