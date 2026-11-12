import EventItem from '@/components/EventItem'
import type { DisplayEvent } from '@/lib/display-event'
import { entryKey, type DayEntry } from '@/lib/week'

type EventLanesProps = {
  entries: DayEntry[]
  onEdit: (event: DisplayEvent) => void
}

export default function EventLanes({ entries, onEdit }: EventLanesProps) {
  return (
    <div data-slot="lanes" className="columns-1 gap-x-2 md:columns-2 2xl:columns-3">
      {entries.map((entry) => (
        <div key={entryKey(entry)} className="mb-2 break-inside-avoid">
          <EventItem entry={entry} onEdit={onEdit} />
        </div>
      ))}
    </div>
  )
}
