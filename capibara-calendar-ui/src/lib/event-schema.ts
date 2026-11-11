import { t } from '@lingui/core/macro'
import { z } from 'zod'

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
    })
    .superRefine((values, context) => {
      const issue = (path: keyof typeof values, message: string) => {
        context.addIssue({ code: 'custom', path: [path], message })
      }
      if (values.endTime && !values.startTime) issue('startTime', t`Enter a start time`)
      if (values.startTime && values.endDate && !values.endTime)
        issue('endTime', t`Enter an end time`)
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
