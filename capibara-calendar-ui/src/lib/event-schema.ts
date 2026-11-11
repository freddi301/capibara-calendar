import { t } from '@lingui/core/macro'
import { z } from 'zod'

export function createEventSchema() {
  return z.object({
    title: z
      .string()
      .trim()
      .min(1, t`Enter a title`),
    date: z.iso.date(t`Enter a valid date`),
  })
}

export type EventFormValues = z.input<ReturnType<typeof createEventSchema>>
