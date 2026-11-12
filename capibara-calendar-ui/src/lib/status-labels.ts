import { msg } from '@lingui/core/macro'
import type { EventStatus } from '@/api/calendar-api'

export const statusLabels: Record<EventStatus, ReturnType<typeof msg>> = {
  confirmed: msg`Confirmed`,
  tentative: msg`Tentative`,
  cancelled: msg`Cancelled`,
}
