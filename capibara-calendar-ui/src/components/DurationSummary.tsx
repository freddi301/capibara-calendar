import { Plural, Trans } from '@lingui/react/macro'
import { cn } from 'cn'
import { daysSpanned, timeSpanned } from '@/lib/duration'
import type { EventFields } from '@/lib/event-schema'

type DurationSummaryProps = {
  range: Pick<EventFields, 'startDate' | 'startTime' | 'endDate' | 'endTime'>
  part: 'days' | 'time' | 'both'
  isAlone?: boolean
}

/** How long an event lasts, in words: "2 days" and "1 h 30 min". */
export default function DurationSummary({ range, part, isAlone = false }: DurationSummaryProps) {
  const time = timeSpanned(range)
  const days = range.startTime ? time?.days : daysSpanned(range)
  const hours = time?.hours ?? 0
  const minutes = time?.minutes ?? 0
  const showTime = !!time && (!days || hours > 0 || minutes > 0)
  const hasDays = (part === 'days' || part === 'both') && !!days
  const hasTime = (part === 'time' || part === 'both') && showTime
  if (isAlone && !hasDays && !hasTime) return null
  return (
    <span className={cn('text-muted-foreground', isAlone && 'text-sm whitespace-nowrap')}>
      {hasDays && <Plural value={days} one="# day" other="# days" />}
      {hasDays && hasTime && ' · '}
      {hasTime && (
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
