import {
  duration,
  localDateTime,
  signedDuration,
  timeZoneId,
  type Alert,
  type CalendarEvent,
  type EditScope,
  type EventValues,
  type RecurrenceRule,
} from '@/api/calendar-api'
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

/** The minutes before the start that the form offers for an alert: the same as the choices of one alert. */
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

/** Alerts that the form cannot show (an absolute time, or from the end): they are kept as they are. */
export const hasCustomAlerts = (alerts: Alert[]) => alerts.some((alert) => !presetOf(alert))

const alertOf = (minutes: number): Alert => ({
  trigger: {
    type: 'offset',
    offset: signedDuration(minutes === 0 ? 'PT0S' : `-PT${minutes}M`),
    relativeTo: 'start',
  },
})

export type FormOptions = { scope?: EditScope; date?: string; appZone: string }

/** The form of an event: what the person sees and changes, in the zone of the event. */
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
  const isUtc = event.timeZone === 'UTC'
  const zone = isUtc ? appZone : (event.timeZone ?? '')
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
    const begin = isUtc
      ? plainOf(start).toZonedDateTime('UTC').withTimeZone(appZone)
      : plainOf(start).toZonedDateTime(event.timeZone ?? appZone)
    startDate = begin.toPlainDate().toString()
    startTime = begin.toPlainTime().toString({ smallestUnit: 'minute' })
    const hasEnd =
      Temporal.Duration.compare(event.duration, zeroDuration, { relativeTo: begin }) > 0
    if (hasEnd) {
      const end = begin.add(Temporal.Duration.from(event.duration))
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
    ...repeatFieldsOf(isSeries ? rules : []),
    location: event.locations.at(0)?.name ?? '',
    tags: joinTags(event.keywords),
    videoLink: event.virtualLocations.at(0)?.uri ?? '',
    alerts: alertsFormOf(event.alerts),
    status: event.status,
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

/** What the form says, as the values of an event: the zone it was written in is the zone of the event. */
export function eventValuesOf(
  form: EventFormValues,
  original: CalendarEvent | undefined,
  options: FormOptions,
): EventValues {
  const isAllDay = !form.startTime
  const zone = isAllDay || !form.timeZone ? null : timeZoneId(form.timeZone)
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
      zone,
      timeZoneId(options.appZone),
    )
  }
  const rules =
    form.repeat === 'custom'
      ? options.scope === 'following'
        ? (original?.series?.recurrenceRulesFromHere ?? original?.recurrenceRules ?? [])
        : (original?.recurrenceRules ?? [])
      : [ruleOf(form, isAllDay)].filter((rule) => rule !== undefined)
  const alerts = [
    ...(form.alerts ?? []).map((minutes) => alertOf(Number(minutes))),
    ...(original?.alerts ?? []).filter((alert) => !presetOf(alert)),
  ]
  const place = (form.location ?? '').trim()
  const link = (form.videoLink ?? '').trim()
  return {
    title: form.title,
    description: form.description,
    start,
    timeZone: zone,
    duration: length,
    showWithoutTime: isAllDay,
    locations: place ? [{ name: place }] : [],
    virtualLocations: link ? [{ uri: link }] : [],
    keywords: splitTags(form.tags ?? ''),
    alerts,
    recurrenceRules: rules,
    status: form.status ?? 'confirmed',
  }
}
