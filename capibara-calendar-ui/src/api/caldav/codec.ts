import ICAL from 'ical.js'
import {
  contactId,
  duration,
  localDateTime,
  signedDuration,
  timeZoneId,
  utcDateTime,
  type Alert,
  type EventStatus,
  type EventValues,
  type Participant,
  type ParticipationStatus,
  type LocalDateTime,
  type RecurrenceRule,
  type TimeZoneId,
} from '../calendar-api'
import { ruleOfRecur, toIcalRecur } from '../shared/recurrence'
import { durationOf, localOf, plainOf, zeroDuration } from '../shared/zones'
import type { RecurrenceOverride, StoredEvent } from '../stored-documents'

export type Resource = Pick<StoredEvent, 'event' | 'recurrenceOverrides'> & { uid: string }

function readCalendar(ics: string) {
  const jcal: unknown = ICAL.parse(ics)
  if (!Array.isArray(jcal)) throw new Error('Not iCalendar')
  return new ICAL.Component(jcal)
}

const masterOf = (calendar: ICAL.Component) => {
  const events = calendar.getAllSubcomponents('vevent')
  return events.find((vevent) => !vevent.hasProperty('recurrence-id')) ?? events.at(0)
}

const text = (vevent: ICAL.Component, name: string) => {
  const value = vevent.getFirstPropertyValue(name)
  return typeof value === 'string' ? value : ''
}

function isZone(value: unknown): value is string {
  if (typeof value !== 'string' || !value) return false
  try {
    Temporal.Now.zonedDateTimeISO(value)
    return true
  } catch {
    return false
  }
}

const utc = timeZoneId('UTC')

function zoneOf(property: ICAL.Property, time: ICAL.Time): TimeZoneId | null {
  if (time.isDate) return null
  const tzid = property.getParameter('tzid')
  if (isZone(tzid)) return timeZoneId(tzid)
  return time.zone === ICAL.Timezone.utcTimezone ? utc : null
}

const wall = (time: ICAL.Time) =>
  localDateTime(
    Temporal.PlainDateTime.from({
      year: time.year,
      month: time.month,
      day: time.day,
      hour: time.isDate ? 0 : time.hour,
      minute: time.isDate ? 0 : time.minute,
      second: time.isDate ? 0 : time.second,
    }).toString({ smallestUnit: 'second' }),
  )

function inZone(time: ICAL.Time, from: TimeZoneId | null, to: TimeZoneId | null) {
  const local = wall(time)
  if (!from || !to || from === to) return local
  return localOf(plainOf(local).toZonedDateTime(from).withTimeZone(to).toPlainDateTime())
}

const timeProperty = (vevent: ICAL.Component, name: string) => {
  const property = vevent.getFirstProperty(name)
  const value = property?.getFirstValue()
  return property && value instanceof ICAL.Time ? { property, time: value } : undefined
}

function durationOfEvent(
  vevent: ICAL.Component,
  start: ICAL.Time,
  zone: TimeZoneId | null,
  isAllDay: boolean,
) {
  const end = timeProperty(vevent, 'dtend')
  if (end) {
    if (isAllDay) {
      const days = Temporal.PlainDate.from(start.toString()).until(
        Temporal.PlainDate.from(end.time.toString()),
        { largestUnit: 'days' },
      ).days
      return duration(`P${Math.max(days, 1)}D`)
    }
    const endZone = zoneOf(end.property, end.time)
    const startWall = wall(start)
    const endWall = inZone(end.time, endZone, zone)
    const from = plainOf(startWall).toZonedDateTime(zone ?? utc)
    const to = plainOf(endWall).toZonedDateTime(zone ?? utc)
    return durationOf(from.until(to, { largestUnit: 'days', smallestUnit: 'second' }))
  }
  const given = vevent.getFirstPropertyValue('duration')
  if (given instanceof ICAL.Duration) return duration(given.toString())
  return isAllDay ? duration('P1D') : zeroDuration
}

function alertsOf(vevent: ICAL.Component): Alert[] {
  return vevent.getAllSubcomponents('valarm').flatMap((alarm): Alert[] => {
    const trigger = alarm.getFirstProperty('trigger')
    const value = trigger?.getFirstValue()
    if (value instanceof ICAL.Duration) {
      const relativeTo = trigger?.getParameter('related') === 'END' ? 'end' : 'start'
      return [{ trigger: { type: 'offset', offset: signedDuration(value.toString()), relativeTo } }]
    }
    if (value instanceof ICAL.Time) {
      const when = value.toString().slice(0, 19)
      return [{ trigger: { type: 'absolute', when: utcDateTime(`${when}Z`) } }]
    }
    return []
  })
}

function rulesOf(vevent: ICAL.Component, zone: TimeZoneId | null, isAllDay: boolean) {
  return vevent.getAllProperties('rrule').flatMap((property): RecurrenceRule[] => {
    const recur = property.getFirstValue()
    if (!(recur instanceof ICAL.Recur)) return []
    const rule = ruleOfRecur(recur)
    if (recur.until && !isAllDay && recur.until.zone === ICAL.Timezone.utcTimezone) {
      rule.until = inZone(recur.until, utc, zone)
    }
    return [rule]
  })
}

const statusCodes = {
  confirmed: 'CONFIRMED',
  tentative: 'TENTATIVE',
  cancelled: 'CANCELLED',
} as const

function statusOf(vevent: ICAL.Component): EventStatus {
  const code = text(vevent, 'status').toUpperCase()
  if (code === statusCodes.cancelled) return 'cancelled'
  return code === statusCodes.tentative ? 'tentative' : 'confirmed'
}

function applyStatus(vevent: ICAL.Component, status: EventStatus) {
  if (statusOf(vevent) === status) return
  vevent.removeAllProperties('status')
  if (status !== 'confirmed') vevent.addPropertyWithValue('status', statusCodes[status])
}

const partstatCodes: Record<ParticipationStatus, string> = {
  'needs-action': 'NEEDS-ACTION',
  accepted: 'ACCEPTED',
  declined: 'DECLINED',
  tentative: 'TENTATIVE',
}

function answerOf(line: ICAL.Property): ParticipationStatus {
  const code = String(line.getParameter('partstat')).toUpperCase()
  const known = (Object.keys(partstatCodes) as ParticipationStatus[]).find(
    (status) => partstatCodes[status] === code,
  )
  return known ?? 'needs-action'
}

const participantsOf = (vevent: ICAL.Component): Participant[] =>
  vevent
    .getAllProperties('attendee')
    .map((line) => ({ id: contactId(String(line.getFirstValue())), status: answerOf(line) }))

function applyParticipants(vevent: ICAL.Component, participants: Participant[]) {
  const wanted = new Map(participants.map(({ id, status }) => [String(id), status]))
  for (const line of vevent.getAllProperties('attendee')) {
    const id = String(line.getFirstValue())
    const status = wanted.get(id)
    if (status === undefined) {
      vevent.removeProperty(line)
      continue
    }
    if (answerOf(line) !== status) line.setParameter('partstat', partstatCodes[status])
    wanted.delete(id)
  }
  for (const [id, status] of wanted) {
    const line = new ICAL.Property('attendee')
    line.setValue(id)
    if (status !== 'needs-action') line.setParameter('partstat', partstatCodes[status])
    line.setParameter('schedule-agent', 'NONE')
    vevent.addProperty(line)
  }
}

function valuesOf(vevent: ICAL.Component): EventValues {
  const start = timeProperty(vevent, 'dtstart')
  if (!start) throw new Error('No start')
  const isAllDay = start.time.isDate
  const zone = zoneOf(start.property, start.time)
  const location = text(vevent, 'location')
  const link = text(vevent, 'conference') || text(vevent, 'x-google-conference')
  return {
    title: text(vevent, 'summary'),
    description: text(vevent, 'description'),
    start: wall(start.time),
    timeZone: zone,
    duration: durationOfEvent(vevent, start.time, zone, isAllDay),
    showWithoutTime: isAllDay,
    locations: location ? [{ name: location }] : [],
    virtualLocations: link ? [{ uri: link }] : [],
    keywords: vevent
      .getAllProperties('categories')
      .flatMap((property) => property.getValues().map(String)),
    alerts: alertsOf(vevent),
    recurrenceRules: rulesOf(vevent, zone, isAllDay),
    status: statusOf(vevent),
    color: text(vevent, 'color') || null,
    participants: participantsOf(vevent),
    organizer: text(vevent, 'organizer') ? contactId(text(vevent, 'organizer')) : null,
  }
}

export function decode(ics: string): Resource | undefined {
  try {
    const calendar = readCalendar(ics)
    const master = masterOf(calendar)
    if (!master) return undefined
    const event = valuesOf(master)
    const recurrenceOverrides: Record<LocalDateTime, RecurrenceOverride> = {}
    for (const vevent of calendar.getAllSubcomponents('vevent')) {
      const id = timeProperty(vevent, 'recurrence-id')
      if (!id || vevent === master) continue
      const at = inZone(id.time, zoneOf(id.property, id.time), event.timeZone)
      recurrenceOverrides[at] = { ...valuesOf(vevent), recurrenceRules: [] }
    }
    for (const property of master.getAllProperties('exdate')) {
      for (const value of property.getValues()) {
        if (!(value instanceof ICAL.Time)) continue
        const at = inZone(value, zoneOf(property, value), event.timeZone)
        recurrenceOverrides[at] = { excluded: true }
      }
    }
    return { uid: text(master, 'uid'), event, recurrenceOverrides }
  } catch {
    return undefined
  }
}

function timeValue(local: LocalDateTime, zone: TimeZoneId | null, isAllDay: boolean) {
  const time = ICAL.Time.fromDateTimeString(local)
  if (isAllDay) return ICAL.Time.fromDateString(local.slice(0, 10))
  if (zone === utc) time.zone = ICAL.Timezone.utcTimezone
  return time
}

function timeProp(name: string, local: LocalDateTime, zone: TimeZoneId | null, isAllDay: boolean) {
  const property = new ICAL.Property(name)
  property.setValue(timeValue(local, zone, isAllDay))
  if (!isAllDay && zone && zone !== utc) property.setParameter('tzid', zone)
  return property
}

function endLocal(values: EventValues) {
  const zone = values.timeZone ?? utc
  return localOf(
    plainOf(values.start)
      .toZonedDateTime(zone)
      .add(Temporal.Duration.from(values.duration))
      .toPlainDateTime(),
  )
}

function applyTimes(vevent: ICAL.Component, values: EventValues) {
  for (const name of ['dtstart', 'dtend', 'duration']) vevent.removeAllProperties(name)
  const isAllDay = values.showWithoutTime
  vevent.addProperty(timeProp('dtstart', values.start, values.timeZone, isAllDay))
  const hasLength =
    Temporal.Duration.compare(values.duration, zeroDuration, { relativeTo: values.start }) > 0
  if (isAllDay) {
    const days = Temporal.Duration.from(values.duration).days
    if (days > 1) {
      const exclusive = plainOf(values.start).add({ days })
      vevent.addProperty(timeProp('dtend', localOf(exclusive), null, true))
    }
  } else if (hasLength) {
    vevent.addProperty(timeProp('dtend', endLocal(values), values.timeZone, false))
  }
}

function untilValue(rule: RecurrenceRule, values: EventValues) {
  if (!rule.until) return undefined
  if (values.showWithoutTime) return ICAL.Time.fromDateString(rule.until.slice(0, 10))
  if (!values.timeZone) return ICAL.Time.fromDateTimeString(rule.until)
  const instant = plainOf(rule.until).toZonedDateTime(values.timeZone).toInstant().toString()
  return ICAL.Time.fromDateTimeString(instant)
}

function applyRules(vevent: ICAL.Component, values: EventValues) {
  vevent.removeAllProperties('rrule')
  for (const rule of values.recurrenceRules) {
    const recur = toIcalRecur(rule)
    const until = untilValue(rule, values)
    if (until) recur.until = until
    vevent.addPropertyWithValue('rrule', recur)
  }
}

function applyDetails(vevent: ICAL.Component, values: EventValues) {
  vevent.updatePropertyWithValue('summary', values.title)
  applyStatus(vevent, values.status)
  applyParticipants(vevent, values.participants)
  if ((text(vevent, 'color') || null) !== values.color) {
    vevent.removeAllProperties('color')
    if (values.color) vevent.addPropertyWithValue('color', values.color)
  }
  vevent.removeAllProperties('description')
  if (values.description) vevent.addPropertyWithValue('description', values.description)
  vevent.removeAllProperties('location')
  const place = values.locations.at(0)?.name.trim()
  if (place) vevent.addPropertyWithValue('location', place)
  vevent.removeAllProperties('categories')
  if (values.keywords.length) {
    vevent.addProperty(new ICAL.Property(['categories', {}, 'text', ...values.keywords]))
  }
  const link = values.virtualLocations.at(0)?.uri
  if (link !== (text(vevent, 'conference') || text(vevent, 'x-google-conference'))) {
    for (const name of ['conference', 'x-google-conference']) vevent.removeAllProperties(name)
    if (link) {
      vevent.addProperty(
        new ICAL.Property(['conference', { value: 'URI', feature: 'VIDEO' }, 'uri', link]),
      )
    }
  }
  for (const alarm of vevent.getAllSubcomponents('valarm')) vevent.removeSubcomponent(alarm)
  for (const { trigger } of values.alerts) {
    const alarm = new ICAL.Component('valarm')
    alarm.addPropertyWithValue('action', 'DISPLAY')
    alarm.addPropertyWithValue('description', values.title)
    if (trigger.type === 'offset') {
      const property = new ICAL.Property('trigger')
      property.setValue(ICAL.Duration.fromString(trigger.offset))
      if (trigger.relativeTo === 'end') property.setParameter('related', 'END')
      alarm.addProperty(property)
    } else {
      const property = new ICAL.Property('trigger')
      property.setValue(ICAL.Time.fromDateTimeString(trigger.when.slice(0, 19)))
      property.setParameter('value', 'DATE-TIME')
      alarm.addProperty(property)
    }
    vevent.addSubcomponent(alarm)
  }
}

function applyValues(vevent: ICAL.Component, values: EventValues) {
  applyTimes(vevent, values)
  applyDetails(vevent, values)
}

const recurrenceIdOf = (vevent: ICAL.Component, zone: TimeZoneId | null) => {
  const id = timeProperty(vevent, 'recurrence-id')
  return id ? inZone(id.time, zoneOf(id.property, id.time), zone) : undefined
}

export function encode(resource: Resource, original?: string) {
  const calendar = original ? readCalendar(original) : new ICAL.Component('vcalendar')
  if (!original) {
    calendar.addPropertyWithValue('version', '2.0')
    calendar.addPropertyWithValue('prodid', '-//capibara-calendar-ui//EN')
  }
  let master = masterOf(calendar)
  if (!master) {
    master = new ICAL.Component('vevent')
    master.addPropertyWithValue('uid', resource.uid)
    master.addPropertyWithValue('dtstamp', ICAL.Time.now())
    calendar.addSubcomponent(master)
  }
  const { event, recurrenceOverrides } = resource
  applyValues(master, event)
  applyRules(master, event)
  master.updatePropertyWithValue('dtstamp', ICAL.Time.now())

  master.removeAllProperties('exdate')
  const previous = new Map<string, ICAL.Component>()
  for (const vevent of calendar.getAllSubcomponents('vevent')) {
    if (vevent === master) continue
    const id = recurrenceIdOf(vevent, event.timeZone)
    if (id) previous.set(id, vevent)
    calendar.removeSubcomponent(vevent)
  }
  for (const [key, override] of Object.entries(recurrenceOverrides)) {
    const at = key as LocalDateTime
    if ('excluded' in override) {
      master.addProperty(timeProp('exdate', at, event.timeZone, event.showWithoutTime))
      continue
    }
    const change = previous.get(at) ?? new ICAL.Component('vevent')
    if (!previous.has(at)) {
      change.addPropertyWithValue('uid', resource.uid)
    }
    change.removeAllProperties('recurrence-id')
    change.addProperty(timeProp('recurrence-id', at, event.timeZone, event.showWithoutTime))
    change.updatePropertyWithValue('dtstamp', ICAL.Time.now())
    applyValues(change, { ...event, ...override, recurrenceRules: [] })
    calendar.addSubcomponent(change)
  }
  return calendar.toString()
}

export function withUid(ics: string, uid: string) {
  const calendar = readCalendar(ics)
  for (const vevent of calendar.getAllSubcomponents('vevent'))
    vevent.updatePropertyWithValue('uid', uid)
  return calendar.toString()
}
