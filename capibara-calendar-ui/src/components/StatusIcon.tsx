import { Ban, Check, CircleHelp } from 'lucide-react'
import type { EventStatus } from '@/api/calendar-api'

export default function StatusIcon({ status }: { status: EventStatus }) {
  if (status === 'cancelled') {
    return <Ban aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
  }
  if (status === 'tentative') {
    return (
      <CircleHelp
        aria-hidden="true"
        className="size-4 shrink-0 text-amber-600 dark:text-amber-400"
      />
    )
  }
  return <Check aria-hidden="true" className="size-4 shrink-0 text-muted-foreground/60" />
}
