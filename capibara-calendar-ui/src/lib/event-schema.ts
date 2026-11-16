import { t } from '@lingui/core/macro'
import { z } from 'zod'

const repeats = ['', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'custom'] as const

export const statuses = ['confirmed', 'tentative', 'cancelled'] as const

export const availabilities = ['busy', 'free'] as const

export const participations = ['needs-action', 'accepted', 'declined', 'tentative'] as const

export const repeatEndings = ['never', 'on', 'after'] as const

export type RepeatEnding = (typeof repeatEndings)[number]

export const reminders = [
  '',
  '0',
  '5',
  '10',
  '15',
  '30',
  '60',
  '120',
  '1440',
  '2880',
  '10080',
  'custom',
] as const

export type Reminder = (typeof reminders)[number]

export const detailDefaults: {
  location: string
  alerts: string[]
  tags: string
  videoLink: string
} = { location: '', alerts: [], tags: '', videoLink: '' }

export const weekdayCodes = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'] as const

export const noRepeat = 'none'

function isWebAddress(value: string) {
  try {
    const { protocol } = new URL(value)
    return protocol === 'https:' || protocol === 'http:'
  } catch {
    return false
  }
}

export function createEventSchema() {
  const date = z.iso.date(t`Enter a valid date`)
  const time = z.iso.time(t`Enter a valid time`)
  const optional = <T extends z.ZodType>(schema: T) => z.union([z.literal(''), schema])

  return z
    .object({
      calendarUrl: z.string().min(1, t`Choose a calendar`),
      title: z
        .string()
        .trim()
        .min(1, t`Enter a title`)
        .transform((title) => title.replace(/\s*\r?\n\s*/g, ' ')),
      description: z.string(),
      startDate: date,
      startTime: optional(time),
      endDate: optional(date),
      endTime: optional(time),
      repeat: z.enum(repeats).optional(),
      repeatUntil: optional(date).optional(),
      repeatInterval: z.string().optional(),
      repeatDays: z.array(z.string()).optional(),
      repeatCount: z.string().optional(),
      repeatEnds: z.enum(repeatEndings).optional(),
      location: z.string().optional(),
      alerts: z.array(z.string()).optional(),
      tags: z.string().optional(),
      videoLink: z.string().trim().optional(),
      timeZone: z.string().optional(),
      status: z.enum(statuses).optional(),
      availability: z.enum(availabilities).optional(),
      eventColor: z.string().optional(),
      participants: z
        .array(z.object({ id: z.string(), status: z.enum(participations) }))
        .optional(),
    })
    .superRefine((values, context) => {
      const issue = (path: keyof typeof values, message: string) => {
        context.addIssue({ code: 'custom', path: [path], message })
      }
      if (values.videoLink && !isWebAddress(values.videoLink)) {
        issue('videoLink', t`Enter a link that starts with https://`)
      }
      if (values.endTime && !values.startTime) issue('startTime', t`Enter a start time`)
      if (values.startTime && values.endDate && !values.endTime)
        issue('endTime', t`Enter an end time`)
      const isRepeated = !!values.repeat && values.repeat !== 'custom'
      if (isRepeated && !/^[1-9]\d*$/.test(values.repeatInterval ?? '1')) {
        issue('repeatInterval', t`Enter a number, 1 or more`)
      }
      if (isRepeated && values.repeatEnds === 'on' && !values.repeatUntil) {
        issue('repeatUntil', t`Choose the day that the repeat ends`)
      }
      if (
        isRepeated &&
        values.repeatEnds === 'after' &&
        !/^[1-9]\d*$/.test(values.repeatCount ?? '')
      ) {
        issue('repeatCount', t`Enter a number, 1 or more`)
      }
      if (values.repeat && values.repeatUntil && values.repeatUntil < values.startDate) {
        issue('repeatUntil', t`The repeat cannot end before the event starts`)
      }
      if (values.endDate && values.endDate < values.startDate) {
        issue('endDate', t`The end cannot be before the start`)
      } else if (
        values.startTime &&
        values.endTime &&
        (values.endDate || values.startDate) === values.startDate &&
        values.endTime < values.startTime
      ) {
        issue('endTime', t`The end cannot be before the start`)
      }
    })
}

export type EventFormValues = z.input<ReturnType<typeof createEventSchema>>

export type EventFields = Omit<EventFormValues, 'calendarUrl'>

export type EventKind = 'allDay' | 'start' | 'startEnd'

export function eventKind({
  startTime,
  endTime,
}: Pick<EventFormValues, 'startTime' | 'endTime'>): EventKind {
  if (!startTime) return 'allDay'
  return endTime ? 'startEnd' : 'start'
}
