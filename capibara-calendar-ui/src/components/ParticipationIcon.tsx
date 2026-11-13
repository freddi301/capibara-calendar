import { CircleCheck, CircleHelp, CircleX, Clock } from 'lucide-react'
import type { ParticipationStatus } from '@/api/calendar-api'

export default function ParticipationIcon({ status }: { status: ParticipationStatus }) {
  if (status === 'accepted') {
    return (
      <CircleCheck
        aria-hidden="true"
        className="size-4 shrink-0 text-green-600 dark:text-green-400"
      />
    )
  }
  if (status === 'declined') {
    return <CircleX aria-hidden="true" className="size-4 shrink-0 text-red-600 dark:text-red-400" />
  }
  if (status === 'tentative') {
    return (
      <CircleHelp
        aria-hidden="true"
        className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
      />
    )
  }
  return <Clock aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
}
