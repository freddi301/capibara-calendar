import { isEqual, omit } from 'es-toolkit'
import {
  contactId,
  duration,
  localDateTime,
  signedDuration,
  timeZoneId,
  type Alert,
  type CalendarEvent,
  type Coordinates,
  type EditScope,
  type EventPatch,
  type EventValues,
  type RecurrenceRule,
} from '@/api/calendar-api'
import { formatCoordinates, parseCoordinates } from './coordinates'
import { isSimpleRule } from '@/api/shared/recurrence'
import { lastDayOf, plainOf, shiftedDuration, zeroDuration } from '@/api/shared/zones'
import type { EventFormValues } from './event-schema'
import { reminders, weekdayCodes } from './event-schema'
import { joinTags, splitTags } from './tags'

type Frequency = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'YEARLY'

const days = (rule: RecurrenceRule) => (rule.byDay ?? []).map(({ day }) => day.toUpperCase())

function repeatFieldsOf(rules: RecurrenceRule[]): Partial<EventFormValues> {
  const none = {
    repeat: '' as const,
    repeatInterval: '1',
    repeatDays: [],
    repeatCount: '',
    repeatUntil: '',
    repeatEnds: 'never' as const,
  }
  const rule = rules.at(0)
  if (!rule) return none
  if (rules.length > 1 || !isSimpleRule(rule)) return { ...none, repeat: 'custom' }
  return {
    repeat: rule.frequency.toUpperCase() as Frequency,
    repeatInterval: String(rule.interval ?? 1),
    repeatDays: days(rule),
    repeatCount: rule.count ? String(rule.count) : '',
    repeatUntil: rule.until ? rule.until.slice(0, 10) : '',
    repeatEnds: rule.count ? 'after' : rule.until ? 'on' : 'never',
  }
}

export const minutesOfAlert = (alert: Alert) => {
  if (alert.trigger.type !== 'offset' || alert.trigger.relativeTo !== 'start') return undefined
  const offset = alert.trigger.offset
  const minutes = Temporal.Duration.from(offset.replace(/^-/, '')).total({
    unit: 'minute',
    relativeTo: '2026-01-01',
  })
  return offset.startsWith('-') || minutes === 0 ? minutes : undefined
}

export const alertChoices = reminders.filter((reminder) => reminder !== '' && reminder !== 'custom')

const presetOf = (alert: Alert) => {
  const minutes = minutesOfAlert(alert)
  return alertChoices.find((choice) => minutes !== undefined && choice === String(minutes))
}

const alertsFormOf = (alerts: Alert[]) =>
  alerts.flatMap((alert) => {
    const preset = presetOf(alert)
    return preset ? [preset] : []
  })

export const hasCustomAlerts = (alerts: Alert[]) => alerts.some((alert) => !presetOf(alert))

const alertOf = (minutes: number): Alert => ({
  trigger: {
    type: 'offset',
    offset: signedDuration(minutes === 0 ? 'PT0S' : `-PT${minutes}M`),
    relativeTo: 'start',
  },
})

export type FormOptions = { scope?: EditScope; date?: string; appZone: string }

export function formValuesOf(
  event: CalendarEvent | undefined,
  options: FormOptions,
): EventFormValues {
  const { appZone } = options
  if (!event) {
    return {
      calendarUrl: '',
      title: '',
      description: '',
      startDate: options.date ?? Temporal.Now.plainDateISO(appZone).toString(),
      startTime: '',
      endDate: '',
      endTime: '',
      timeZone: appZone,
      endTimeZone: appZone,
    }
  }
  const scope = options.scope
  const isSeries = event.recurrenceRules.length > 0
  const isOccurrence = scope === 'one' || scope === 'following'
  const start = !isOccurrence && event.series ? event.series.start : event.start
  const rules =
    scope === 'one'
      ? []
      : scope === 'following'
        ? (event.series?.recurrenceRulesFromHere ?? event.recurrenceRules)
        : event.recurrenceRules
  const zone = event.timeZone ?? ''
  const base = { ...event, start, timeZone: event.timeZone }
  let startDate: string
  let startTime = ''
  let endDate = ''
  let endTime = ''
  if (event.showWithoutTime) {
    startDate = start.slice(0, 10)
    const last = lastDayOf(base)
    endDate = last > startDate ? last : ''
  } else {
    const begin = plainOf(start).toZonedDateTime(event.timeZone ?? appZone)
    startDate = begin.toPlainDate().toString()
    startTime = begin.toPlainTime().toString({ smallestUnit: 'minute' })
    const hasEnd =
      Temporal.Duration.compare(event.duration, zeroDuration, { relativeTo: begin }) > 0
    if (hasEnd) {
      const end = begin
        .add(Temporal.Duration.from(event.duration))
        .withTimeZone(event.endTimeZone ?? event.timeZone ?? appZone)
      endDate = end.toPlainDate().toString()
      endTime = end.toPlainTime().toString({ smallestUnit: 'minute' })
    }
  }
  return {
    calendarUrl: `${event.ref.sourceId}/${event.ref.calendarId}`,
    title: event.title,
    description: event.description,
    startDate,
    startTime,
    endDate,
    endTime,
    timeZone: event.showWithoutTime ? appZone : zone,
    endTimeZone: event.showWithoutTime ? appZone : (event.endTimeZone ?? zone),
    ...repeatFieldsOf(isSeries ? rules : []),
    location: event.locations.at(0)?.name ?? '',
    coordinates: coordinatesText(event.locations.at(0)?.coordinates),
    tags: joinTags(event.keywords),
    videoLink: event.virtualLocations.at(0)?.uri ?? '',
    alerts: alertsFormOf(event.alerts),
    status: event.status,
    availability: event.availability,
    eventColor: event.color ?? '',
    participants: event.participants.map(({ id, status }) => ({ id, status })),
  }
}

function ruleOf(form: EventFormValues, isAllDay: boolean): RecurrenceRule | undefined {
  const frequency = form.repeat
  if (!frequency || frequency === 'custom') return undefined
  const interval = Number(form.repeatInterval ?? 1)
  const ends = form.repeatEnds ?? (form.repeatUntil ? 'on' : 'never')
  const rule: RecurrenceRule = {
    frequency: frequency.toLowerCase() as RecurrenceRule['frequency'],
    ...(interval > 1 ? { interval } : {}),
  }
  if (frequency === 'WEEKLY' && form.repeatDays?.length) {
    rule.byDay = weekdayCodes
      .filter((code) => form.repeatDays?.includes(code))
      .map((code) => ({
        day: code.toLowerCase() as NonNullable<RecurrenceRule['byDay']>[number]['day'],
      }))
  }
  if (ends === 'on' && form.repeatUntil) {
    rule.until = localDateTime(`${form.repeatUntil}T${isAllDay ? '00:00:00' : '23:59:59'}`)
  }
  if (ends === 'after' && Number(form.repeatCount) > 0) rule.count = Number(form.repeatCount)
  return rule
}

/** The fields that tell when the end is, and that are checked again when a zone changes. */
export const endFields = ['endDate', 'endTime'] as const

const whenKeys = [
  'startDate',
  'startTime',
  'endDate',
  'endTime',
  'timeZone',
  'endTimeZone',
] as const

function whenOf(form: EventFormValues, options: FormOptions) {
  const isAllDay = !form.startTime
  const zone = isAllDay || !form.timeZone ? null : timeZoneId(form.timeZone)
  const endZone =
    zone && form.endTime && form.endTimeZone && form.endTimeZone !== form.timeZone
      ? timeZoneId(form.endTimeZone)
      : null
  const start = localDateTime(`${form.startDate}T${isAllDay ? '00:00' : form.startTime}:00`)
  const lastDate = form.endDate || form.startDate
  let length = zeroDuration
  if (isAllDay) {
    const count = Temporal.PlainDate.from(form.startDate).until(Temporal.PlainDate.from(lastDate), {
      largestUnit: 'days',
    }).days
    length = duration(`P${Math.max(count, 0) + 1}D`)
  } else if (form.endTime) {
    length = shiftedDuration(
      start,
      localDateTime(`${lastDate}T${form.endTime}:00`),
      { start: zone, end: endZone },
      timeZoneId(options.appZone),
    )
  }
  return {
    start,
    timeZone: zone,
    endTimeZone: endZone,
    duration: length,
    showWithoutTime: isAllDay,
  }
}

const alertsOf = (form: EventFormValues, original: CalendarEvent | undefined) => [
  ...(form.alerts ?? []).map((minutes) => alertOf(Number(minutes))),
  ...(original?.alerts ?? []).filter((alert) => !presetOf(alert)),
]

export function eventValuesOf(
  form: EventFormValues,
  original: CalendarEvent | undefined,
  options: FormOptions,
): EventValues {
  const when = whenOf(form, options)
  const rules =
    form.repeat === 'custom'
      ? options.scope === 'following'
        ? (original?.series?.recurrenceRulesFromHere ?? original?.recurrenceRules ?? [])
        : (original?.recurrenceRules ?? [])
      : [ruleOf(form, when.showWithoutTime)].filter((rule) => rule !== undefined)
  const link = (form.videoLink ?? '').trim()
  return {
    title: form.title,
    description: form.description,
    ...when,
    locations: [locationOf(form, original)].filter((location) => location !== undefined),
    virtualLocations: link ? [{ uri: link }] : [],
    keywords: splitTags(form.tags ?? ''),
    alerts: alertsOf(form, original),
    recurrenceRules: rules,
    status: form.status ?? 'confirmed',
    availability: form.availability ?? 'busy',
    color: form.eventColor || null,
    participants: (form.participants ?? []).map(({ id, status }) => ({
      id: contactId(id),
      status,
    })),
    organizer: original?.organizer ?? null,
  }
}

function plainRule(rule: RecurrenceRule | undefined, startDate: string) {
  const day = rule?.byDay?.at(0)
  const isStartDay =
    rule?.frequency === 'weekly' &&
    rule.byDay?.length === 1 &&
    day?.nthOfPeriod === undefined &&
    /^\d{4}-\d{2}-\d{2}$/.test(startDate) &&
    day?.day === weekdayCodes[Temporal.PlainDate.from(startDate).dayOfWeek - 1].toLowerCase()
  if (!rule || !isStartDay) return rule
  return omit(rule, ['byDay'])
}

const rulesOf = (form: EventFormValues) =>
  [plainRule(ruleOf(form, !form.startTime), form.startDate)].filter((rule) => rule !== undefined)

const same = (first: unknown, second: unknown) => isEqual(first ?? '', second ?? '')

const changed = (
  form: EventFormValues,
  initial: EventFormValues,
  keys: readonly (keyof EventFormValues)[],
) => keys.some((key) => !same(form[key], initial[key]))

const coordinatesText = (coordinates: Coordinates | undefined) =>
  coordinates ? formatCoordinates(coordinates) : ''

/** The place of the form. Coordinates that were not edited keep all the digits of the event. */
function locationOf(form: EventFormValues, original: CalendarEvent | undefined) {
  const name = (form.location ?? '').trim()
  const text = (form.coordinates ?? '').trim()
  const kept = original?.locations.at(0)?.coordinates
  const coordinates = kept && coordinatesText(kept) === text ? kept : parseCoordinates(text)
  return name || coordinates ? { name, ...(coordinates && { coordinates }) } : undefined
}

const withFirst = <Item>(list: Item[], first: Item | undefined) =>
  first === undefined ? list.slice(1) : [first, ...list.slice(1)]

export function eventPatchOf(
  form: EventFormValues,
  initial: EventFormValues,
  original: CalendarEvent,
  options: FormOptions,
): EventPatch {
  const patch: EventPatch = {}
  if (!same(form.title, initial.title)) patch.title = form.title
  if (!same(form.description, initial.description)) patch.description = form.description
  const when = whenOf(form, options)
  if (changed(form, initial, whenKeys)) Object.assign(patch, when)
  if (!same(rulesOf(form), rulesOf(initial))) {
    patch.recurrenceRules = [ruleOf(form, when.showWithoutTime)].filter(
      (rule) => rule !== undefined,
    )
  }
  if (changed(form, initial, ['location', 'coordinates'])) {
    patch.locations = withFirst(original.locations, locationOf(form, original))
  }
  if (!same(form.videoLink, initial.videoLink)) {
    const link = (form.videoLink ?? '').trim()
    patch.virtualLocations = withFirst(
      original.virtualLocations,
      link ? { ...original.virtualLocations.at(0), uri: link } : undefined,
    )
  }
  if (!same(form.tags, initial.tags)) patch.keywords = splitTags(form.tags ?? '')
  if (!same(form.alerts, initial.alerts)) patch.alerts = alertsOf(form, original)
  if (!same(form.status, initial.status)) patch.status = form.status ?? 'confirmed'
  if (!same(form.availability, initial.availability)) {
    patch.availability = form.availability ?? 'busy'
  }
  if (!same(form.eventColor, initial.eventColor)) patch.color = form.eventColor || null
  const now = form.participants ?? []
  const before = initial.participants ?? []
  const set = now.filter(({ id, status }) => before.find((one) => one.id === id)?.status !== status)
  const remove = before.filter(({ id }) => !now.some((one) => one.id === id)).map(({ id }) => id)
  if (set.length || remove.length) {
    patch.participants = {
      set: set.map(({ id, status }) => ({ id: contactId(id), status })),
      remove: remove.map(contactId),
    }
  }
  return patch
}
