import { Plural, Trans } from '@lingui/react/macro'
import { daysSpanned, timeSpanned } from '@/lib/duration'
import type { EventFields } from '@/lib/event-schema'

type DurationSummaryProps = {
  range: Pick<EventFields, 'startDate' | 'startTime' | 'endDate' | 'endTime'>
  part: 'days' | 'time'
}

export default function DurationSummary({ range, part }: DurationSummaryProps) {
  const time = timeSpanned(range)
  const days = range.startTime ? time?.days : daysSpanned(range)
  const hours = time?.hours ?? 0
  const minutes = time?.minutes ?? 0
  const showTime = time && (!days || hours > 0 || minutes > 0)
  return (
    <span className="text-muted-foreground">
      {part === 'days' && !!days && <Plural value={days} one="# day" other="# days" />}
      {part === 'time' && showTime && (
        <>
          {hours > 0 && minutes > 0 && (
            <Trans>
              {hours} h {minutes} min
            </Trans>
          )}
          {hours > 0 && minutes === 0 && <Trans>{hours} h</Trans>}
          {hours === 0 && <Trans>{minutes} min</Trans>}
        </>
      )}
    </span>
  )
}
