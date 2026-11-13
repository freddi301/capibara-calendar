import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import type { ParticipationStatus } from '@/api/calendar-api'
import { participationSegments, segmentStyle } from '@/lib/participation-colors'
import { participationLabels } from '@/lib/participation-labels'

export default function ParticipationBar({ statuses }: { statuses: ParticipationStatus[] }) {
  const { i18n } = useLingui()
  return (
    <div role="group" className="flex h-6 overflow-hidden rounded-full">
      {participationSegments.map(({ status, color }) => {
        const count = statuses.filter((one) => one === status).length
        return (
          <span
            key={status}
            title={i18n._(participationLabels[status])}
            style={{ flexGrow: count }}
            className={cn(segmentStyle, color, count > 0 ? 'min-w-7' : 'min-w-0')}
          >
            {count > 0 && count}
          </span>
        )
      })}
    </div>
  )
}
