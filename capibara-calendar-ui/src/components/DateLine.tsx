import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { CalendarCheck, ChevronLeft, ChevronRight } from 'lucide-react'
import type { ReactNode } from 'react'
import CurrentDate from '@/components/CurrentDate'
import { Button } from '@/components/ui/button'
import { longestWeekday } from '@/lib/format'
import { usePhonePortrait } from '@/lib/use-phone-portrait'
import { stepDate, type DateStep } from '@/lib/week'

type DateLineProps = {
  isBordered?: boolean
  actions?: ReactNode
  leading?: ReactNode
  step: DateStep
  selected: Temporal.PlainDate
  today: Temporal.PlainDate
  onSelect: (day: Temporal.PlainDate) => void
}

type StepButtonProps = {
  label: string
  direction: 1 | -1
  isAtEdge: boolean
  onStep: (direction: 1 | -1) => void
}

function StepButton({ label, direction, isAtEdge, onStep }: StepButtonProps) {
  const Icon = direction === 1 ? ChevronRight : ChevronLeft
  const isOnRight = isAtEdge === (direction === 1)
  const button = (
    <Button
      variant="ghost"
      className={cn(
        'absolute top-0 z-10 size-11 text-muted-foreground',
        isOnRight ? 'right-0' : 'left-0',
      )}
      aria-label={label}
      onClick={() => {
        onStep(direction)
      }}
    >
      <Icon className="size-6" />
    </Button>
  )
  return isAtEdge ? button : <span className="relative h-11 w-0">{button}</span>
}

export default function DateLine({
  isBordered = false,
  actions,
  leading,
  step,
  selected,
  today,
  onSelect,
}: DateLineProps) {
  const { t, i18n } = useLingui()
  const isTop = !usePhonePortrait()
  const hasActions = isTop && actions !== undefined
  const hasLeading = isTop && leading !== undefined
  const labels = {
    day: { previous: t`Previous day`, next: t`Next day` },
    week: { previous: t`Previous week`, next: t`Next week` },
    month: { previous: t`Previous month`, next: t`Next month` },
  }[step]
  const move = (direction: 1 | -1) => {
    onSelect(stepDate(selected, direction, step))
  }
  const isAtEdge = !isTop
  const previous = (
    <StepButton label={labels.previous} direction={-1} isAtEdge={isAtEdge} onStep={move} />
  )
  const next = <StepButton label={labels.next} direction={1} isAtEdge={isAtEdge} onStep={move} />
  return (
    <div
      style={{
        gridTemplateColumns: `minmax(${hasLeading ? `calc(${longestWeekday(i18n.locale)}ch + 5.5rem)` : `${longestWeekday(i18n.locale)}ch`}, 1fr) auto minmax(${hasActions ? '14rem' : '2.25rem'}, 1fr)`,
      }}
      className={cn(
        'relative grid h-11 items-center gap-x-2 bg-bar px-2 text-lg [&_button]:rounded-none',
        isBordered && 'border-b',
      )}
    >
      <CurrentDate
        selected={selected}
        onSelect={onSelect}
        leading={hasLeading ? leading : undefined}
        previous={isTop ? previous : undefined}
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
        {isTop && next}
        {hasActions && <div className="ml-auto flex items-center">{actions}</div>}
      </div>
      {!isTop && previous}
      {!isTop && next}
    </div>
  )
}
