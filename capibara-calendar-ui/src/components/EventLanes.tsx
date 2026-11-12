import EventItem from '@/components/EventItem'
import type { CalendarEvent } from '@/lib/caldav'
import { entryKey, type DayEntry } from '@/lib/week'

type EventLanesProps = {
  entries: DayEntry[]
  onEdit: (event: CalendarEvent) => void
}

// The events of a day packed in columns: one on a phone, two on a tablet or on half of a desktop,
// three on a full one. Each event is as high as it is, and the columns are of the same height.
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
