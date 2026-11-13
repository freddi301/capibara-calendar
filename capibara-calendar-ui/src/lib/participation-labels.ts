import { msg } from '@lingui/core/macro'
import type { ParticipationStatus } from '@/api/calendar-api'

export const participationLabels: Record<ParticipationStatus, ReturnType<typeof msg>> = {
  'needs-action': msg`No answer`,
  accepted: msg`Accepted`,
  declined: msg`Declined`,
  tentative: msg`Maybe`,
}
