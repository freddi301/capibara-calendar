import {
  revision,
  type CalendarEvent,
  type CalendarId,
  type DateRange,
  type EditScope,
  type EventId,
  type EventValues,
  type LocalDateTime,
  type RecurrenceRule,
  type SourceId,
  type TimeZoneId,
} from '../calendar-api'
import type { RecurrenceOverride, StoredEvent } from '../stored-documents'
import { occurrenceStarts } from './recurrence'
import { displayTimes, localOf, overlapsRange, plainOf } from './zones'

export type Occurrence = {
  values: EventValues
  recurrenceId?: LocalDateTime
  index: number
}

export type Changes = { write: StoredEvent[]; remove: EventId[] }

const isExcluded = (override: RecurrenceOverride | undefined): override is { excluded: true } =>
  override !== undefined && 'excluded' in override

function occurrenceValues(
  doc: StoredEvent,
  start: LocalDateTime,
  override: RecurrenceOverride | undefined,
): EventValues {
  const patch = override && !isExcluded(override) ? override : {}
  return { ...doc.event, start, ...patch, recurrenceRules: doc.event.recurrenceRules }
}

export function occurrencesOf(doc: StoredEvent, range: DateRange, appZone: TimeZoneId) {
  const rules = doc.event.recurrenceRules
  if (!rules.length) {
    return overlapsRange(doc.event, range, appZone) ? [{ values: doc.event, index: 0 }] : []
  }
  const found: Occurrence[] = []
  const stop = plainOf(`${range.end}T00:00:00` as LocalDateTime).add({ days: 3 })
  let index = -1
  for (const start of occurrenceStarts(doc.event.start, rules)) {
    index++
    if (plainOf(start).toPlainDate().since(stop.toPlainDate()).days > 0) break
    const override = doc.recurrenceOverrides[start]
    if (isExcluded(override)) continue
    const values = occurrenceValues(doc, start, override)
    if (overlapsRange(values, range, appZone)) found.push({ values, recurrenceId: start, index })
  }
  return found
}

export function occurrenceFor(
  doc: StoredEvent,
  recurrenceId?: LocalDateTime,
): Occurrence | undefined {
  const rules = doc.event.recurrenceRules
  if (!recurrenceId || !rules.length) return { values: doc.event, index: 0 }
  let index = -1
  for (const start of occurrenceStarts(doc.event.start, rules)) {
    index++
    if (start < recurrenceId) continue
    if (start > recurrenceId) return undefined
    const override = doc.recurrenceOverrides[start]
    if (isExcluded(override)) return undefined
    return { values: occurrenceValues(doc, start, override), recurrenceId: start, index }
  }
  return undefined
}

const recurrenceFromHere = (rules: RecurrenceRule[], index: number) =>
  rules.map((rule) => (rule.count ? { ...rule, count: Math.max(rule.count - index, 1) } : rule))

export function toCalendarEvent(
  doc: StoredEvent,
  occurrence: Occurrence,
  where: { sourceId: SourceId; calendarId: CalendarId; color?: string },
): CalendarEvent {
  const { recurrenceId } = occurrence
  return {
    ...occurrence.values,
    ref: {
      sourceId: where.sourceId,
      calendarId: where.calendarId,
      eventId: doc.id,
      ...(recurrenceId ? { recurrenceId } : {}),
    },
    revision: revision(String(doc.revision)),
    ...(where.color ? { color: where.color } : {}),
    ...(recurrenceId
      ? {
          series: {
            start: doc.event.start,
            recurrenceRulesFromHere: recurrenceFromHere(
              doc.event.recurrenceRules,
              occurrence.index,
            ),
          },
        }
      : {}),
  }
}

export function sortByStart(events: CalendarEvent[], appZone: TimeZoneId) {
  const key = (event: CalendarEvent) => {
    const { startDate, startTime } = displayTimes(event, appZone)
    return `${startDate} ${startTime}`
  }
  return events.sort((a, b) => key(a).localeCompare(key(b)))
}

function truncateBefore(rules: RecurrenceRule[], recurrenceId: LocalDateTime, index: number) {
  const until = localOf(plainOf(recurrenceId).subtract({ seconds: 1 }))
  return rules.map((rule): RecurrenceRule => {
    const { count, ...rest } = rule
    return count ? { ...rule, count: Math.max(index, 1) } : { ...rest, until }
  })
}

function splitOverrides(doc: StoredEvent, recurrenceId: LocalDateTime) {
  const before: StoredEvent['recurrenceOverrides'] = {}
  const after: StoredEvent['recurrenceOverrides'] = {}
  for (const [key, override] of Object.entries(doc.recurrenceOverrides)) {
    const start = key as LocalDateTime
    if (start >= recurrenceId) after[start] = override
    else before[start] = override
  }
  return { before, after }
}

export function newDocument(id: EventId, calendarId: CalendarId, values: EventValues): StoredEvent {
  return { id, calendarId, revision: 1, event: values, recurrenceOverrides: {} }
}

export function updateDocument(
  doc: StoredEvent,
  values: EventValues,
  recurrenceId: LocalDateTime | undefined,
  scope: EditScope,
  makeId: () => EventId,
): Changes {
  const isSeries = doc.event.recurrenceRules.length > 0 && recurrenceId !== undefined
  const isFirst = recurrenceId === doc.event.start
  if (!isSeries || scope === 'all' || (scope === 'following' && isFirst)) {
    return { write: [{ ...doc, event: values }], remove: [] }
  }
  if (scope === 'one') {
    const override = { ...values, recurrenceRules: [] }
    return {
      write: [
        { ...doc, recurrenceOverrides: { ...doc.recurrenceOverrides, [recurrenceId]: override } },
      ],
      remove: [],
    }
  }
  const index = occurrenceFor(doc, recurrenceId)?.index ?? 0
  const { before, after } = splitOverrides(doc, recurrenceId)
  const ended: StoredEvent = {
    ...doc,
    event: {
      ...doc.event,
      recurrenceRules: truncateBefore(doc.event.recurrenceRules, recurrenceId, index),
    },
    recurrenceOverrides: before,
  }
  const later = newDocument(makeId(), doc.calendarId, values)
  return { write: [ended, { ...later, recurrenceOverrides: after }], remove: [] }
}

export function deleteDocument(
  doc: StoredEvent,
  recurrenceId: LocalDateTime | undefined,
  scope: EditScope,
): Changes {
  const isSeries = doc.event.recurrenceRules.length > 0 && recurrenceId !== undefined
  const isFirst = recurrenceId === doc.event.start
  if (!isSeries || scope === 'all' || (scope === 'following' && isFirst)) {
    return { write: [], remove: [doc.id] }
  }
  if (scope === 'one') {
    return {
      write: [
        {
          ...doc,
          recurrenceOverrides: { ...doc.recurrenceOverrides, [recurrenceId]: { excluded: true } },
        },
      ],
      remove: [],
    }
  }
  const index = occurrenceFor(doc, recurrenceId)?.index ?? 0
  const { before } = splitOverrides(doc, recurrenceId)
  return {
    write: [
      {
        ...doc,
        event: {
          ...doc.event,
          recurrenceRules: truncateBefore(doc.event.recurrenceRules, recurrenceId, index),
        },
        recurrenceOverrides: before,
      },
    ],
    remove: [],
  }
}
