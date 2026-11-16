import { msg } from '@lingui/core/macro'
import type { EventAvailability } from '@/api/calendar-api'

export const availabilityLabels: Record<EventAvailability, ReturnType<typeof msg>> = {
  busy: msg`Busy`,
  free: msg`Free`,
}

export const availabilityHints: Record<EventAvailability, ReturnType<typeof msg>> = {
  busy: msg`Whoever accepts to join this event will show as busy`,
  free: msg`Whoever accepts to join this event will show as free`,
}
