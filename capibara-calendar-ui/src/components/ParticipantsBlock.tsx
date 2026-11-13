import { useAutoAnimate } from '@formkit/auto-animate/react'
import { Users } from 'lucide-react'
import type { ReactNode } from 'react'
import type { ParticipationStatus } from '@/api/calendar-api'
import { RowIcon } from '@/components/EventDetails'
import ParticipationBar from '@/components/ParticipationBar'

/**
 * The people of an event: above their names the bar of their answers, and above the sign of the people how many
 * they are. The same in the form and in the screen of the event.
 */
export default function ParticipantsBlock({
  statuses,
  children,
}: {
  statuses: ParticipationStatus[]
  children: ReactNode
}) {
  const [gridRef] = useAutoAnimate()
  return (
    <div
      ref={gridRef}
      className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-start gap-x-3 gap-y-1"
    >
      {statuses.length > 0 && (
        <>
          <span className="flex h-6 items-center justify-center text-sm font-medium text-muted-foreground tabular-nums">
            {statuses.length}
          </span>
          <ParticipationBar statuses={statuses} />
        </>
      )}
      <RowIcon icon={Users} />
      {children}
    </div>
  )
}
