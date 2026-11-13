import { t } from '@lingui/core/macro'
import { z } from 'zod'

export function createCalendarSchema() {
  return z.object({
    name: z
      .string()
      .trim()
      .min(1, t`Enter a name`),
    color: z.string().regex(/^(#[0-9a-f]{6})?$/i),
  })
}

export type CalendarValues = z.input<ReturnType<typeof createCalendarSchema>>

export const nameField: keyof CalendarValues = 'name'
