import { isEqual } from 'es-toolkit'
import ICAL from 'ical.js'
import { decode, type Resource } from '@/api/caldav/codec'
import { matches, type Group } from './event-filter'

export type Incoming = {
  uid: string
  ics: string
  resource: Resource
  occurrences: number
}

type ImportProblem = { kind: 'file' | 'unreadable' | 'no-uid'; uid?: string }

export type ParsedFile = {
  events: Incoming[]
  skipped: number
  problems: ImportProblem[]
}

function calendarsIn(text: string) {
  const parsed = ICAL.parse(text) as unknown[]
  const list = Array.isArray(parsed[0]) ? (parsed as unknown[][]) : [parsed]
  return list.map((jcal) => new ICAL.Component(jcal))
}

export function parseCalendarFile(text: string): ParsedFile {
  let calendars: ICAL.Component[]
  try {
    calendars = calendarsIn(text)
  } catch {
    return { events: [], skipped: 0, problems: [{ kind: 'file' }] }
  }
  const groups = new Map<string, { vevents: ICAL.Component[]; zones: ICAL.Component[] }>()
  const problems: ImportProblem[] = []
  let skipped = 0
  for (const calendar of calendars) {
    const zones = calendar.getAllSubcomponents('vtimezone')
    for (const part of calendar.getAllSubcomponents()) {
      if (part.name === 'vtimezone') continue
      if (part.name !== 'vevent') {
        skipped += 1
        continue
      }
      const uid = part.getFirstPropertyValue('uid')
      if (typeof uid !== 'string' || !uid) {
        problems.push({ kind: 'no-uid' })
        continue
      }
      const group = groups.get(uid) ?? { vevents: [], zones: [] }
      group.vevents.push(part)
      group.zones.push(...zones)
      groups.set(uid, group)
    }
  }
  const events: Incoming[] = []
  for (const [uid, { vevents, zones }] of groups) {
    const calendar = new ICAL.Component('vcalendar')
    calendar.addPropertyWithValue('version', '2.0')
    calendar.addPropertyWithValue('prodid', '-//capibara-calendar-ui//EN')
    const seen = new Set<string>()
    for (const zone of zones) {
      const tzid = String(zone.getFirstPropertyValue('tzid'))
      if (seen.has(tzid)) continue
      seen.add(tzid)
      calendar.addSubcomponent(zone)
    }
    for (const vevent of vevents) calendar.addSubcomponent(vevent)
    const ics = calendar.toString()
    const resource = decode(ics)
    if (!resource) {
      problems.push({ kind: 'unreadable', uid })
      continue
    }
    events.push({
      uid,
      ics,
      resource,
      occurrences: vevents.filter((vevent) => vevent.hasProperty('recurrence-id')).length,
    })
  }
  return { events, skipped, problems }
}

function versionOf(resource: Resource, ics: string) {
  const stamp = new ICAL.Component(ICAL.parse(ics) as unknown[])
    .getAllSubcomponents('vevent')
    .find((vevent) => !vevent.hasProperty('recurrence-id'))
    ?.getFirstPropertyValue('dtstamp')
  const changed = resource.modified
    ? Date.parse(resource.modified)
    : stamp instanceof ICAL.Time
      ? stamp.toJSDate().getTime()
      : 0
  return { sequence: resource.sequence ?? 0, changed }
}

type Decision = 'ignored' | 'new' | 'update' | 'current'
export type Planned = Incoming & { decision: Decision }

export function planImport(events: Incoming[], existing: string[], rules: Group): Planned[] {
  const there = new Map<string, { resource: Resource; ics: string }>()
  for (const ics of existing) {
    const resource = decode(ics)
    if (resource) there.set(resource.uid, { resource, ics })
  }
  return events.map((incoming) => {
    if (!matches(rules, incoming.resource.event)) return { ...incoming, decision: 'ignored' }
    const found = there.get(incoming.uid)
    if (!found) return { ...incoming, decision: 'new' }
    const same =
      isEqual(incoming.resource.event, found.resource.event) &&
      isEqual(incoming.resource.recurrenceOverrides, found.resource.recurrenceOverrides)
    if (same) return { ...incoming, decision: 'current' }
    const mine = versionOf(incoming.resource, incoming.ics)
    const theirs = versionOf(found.resource, found.ics)
    const order =
      mine.sequence - theirs.sequence ||
      mine.changed - theirs.changed ||
      JSON.stringify(incoming.resource.event).localeCompare(JSON.stringify(found.resource.event))
    return { ...incoming, decision: order > 0 ? 'update' : 'current' }
  })
}

export type Totals = Record<Decision, { events: number; occurrences: number }>

export function totalsOf(planned: Planned[]): Totals {
  const totals: Totals = {
    ignored: { events: 0, occurrences: 0 },
    new: { events: 0, occurrences: 0 },
    update: { events: 0, occurrences: 0 },
    current: { events: 0, occurrences: 0 },
  }
  for (const { decision, occurrences } of planned) {
    totals[decision].events += 1
    totals[decision].occurrences += occurrences
  }
  return totals
}
