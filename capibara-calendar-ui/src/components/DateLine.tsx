import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { CalendarCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import CurrentDate from '@/components/CurrentDate'
import { Button } from '@/components/ui/button'
import { longestWeekday } from '@/lib/format'
import { usePhonePortrait } from '@/lib/use-phone-portrait'

type DateLineProps = {
  isBordered?: boolean
  actions?: ReactNode
  leading?: ReactNode
  selected: Temporal.PlainDate
  today: Temporal.PlainDate
  onSelect: (day: Temporal.PlainDate) => void
}

export default function DateLine({
  isBordered = false,
  actions,
  leading,
  selected,
  today,
  onSelect,
}: DateLineProps) {
  const { t, i18n } = useLingui()
  const isTop = !usePhonePortrait()
  const hasActions = isTop && actions !== undefined
  const hasLeading = isTop && leading !== undefined
  return (
    <div
      style={{
        gridTemplateColumns: `minmax(${hasLeading ? `calc(${longestWeekday(i18n.locale)}ch + 5.5rem)` : `${longestWeekday(i18n.locale)}ch`}, 1fr) auto minmax(${hasActions ? '14rem' : '2.25rem'}, 1fr)`,
      }}
      className={cn(
        'grid h-11 items-center gap-x-2 px-2 text-lg [&_button]:rounded-none',
        isBordered && 'border-b',
      )}
    >
      <CurrentDate
        selected={selected}
        onSelect={onSelect}
        leading={hasLeading ? leading : undefined}
      />
      <div className="flex items-center">
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
        {hasActions && <div className="ml-auto flex items-center">{actions}</div>}
      </div>
    </div>
  )
}
