import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { CalendarCheck } from 'lucide-react'
import CurrentDate from '@/components/CurrentDate'
import { Button } from '@/components/ui/button'
import { longestWeekday } from '@/lib/format'

type DateLineProps = {
  isBordered?: boolean
  selected: Temporal.PlainDate
  today: Temporal.PlainDate
  onSelect: (day: Temporal.PlainDate) => void
}

// The top bar of the lists: the day, the month and the year are in the middle, the name of the day
// hangs on their left and the way back to today on their right. When a side is not wide enough for
// what hangs there, the middle is moved away from it, and is not in the middle any more.
export default function DateLine({ isBordered = false, selected, today, onSelect }: DateLineProps) {
  const { t, i18n } = useLingui()
  return (
    <div
      style={{
        gridTemplateColumns: `minmax(${longestWeekday(i18n.locale)}ch, 1fr) auto minmax(2.25rem, 1fr)`,
      }}
      className={cn('grid h-11 items-center gap-x-2 px-2', isBordered && 'border-b')}
    >
      <CurrentDate selected={selected} onSelect={onSelect} />
      <div className="flex items-center justify-start">
        <Button
          variant="ghost"
          className="size-8 text-muted-foreground"
          aria-label={t`Today`}
          onClick={() => {
            onSelect(today)
          }}
        >
          <CalendarCheck className="size-5" />
        </Button>
      </div>
    </div>
  )
}
