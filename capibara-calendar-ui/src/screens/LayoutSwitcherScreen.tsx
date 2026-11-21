import { Trans, useLingui } from '@lingui/react/macro'
import {
  CalendarDays,
  CalendarRange,
  ChartNoAxesGantt,
  Check,
  Clock,
  List,
  Rows4,
} from 'lucide-react'
import BottomBar from '@/components/BottomBar'
import SheetBack, { SheetTitle } from '@/components/SheetBack'
import { Button } from '@/components/ui/button'
import type { Layout } from '@/lib/layout'

type LayoutSwitcherScreenProps = {
  layout: Layout
  onChoose: (layout: Layout) => void
  onClose: () => void
}

export default function LayoutSwitcherScreen({
  layout,
  onChoose,
  onClose,
}: LayoutSwitcherScreenProps) {
  const { t } = useLingui()
  const options = [
    { value: 'agenda', label: t`Agenda`, icon: List },
    { value: 'weekRows', label: t`Week`, icon: CalendarRange },
    { value: 'monthTable', label: t`Month`, icon: CalendarDays },
    { value: 'timelineDay', label: t`Timeline day`, icon: Clock },
    { value: 'timelineWeek', label: t`Timeline week`, icon: ChartNoAxesGantt },
    { value: 'timelineMonth', label: t`Timeline month`, icon: Rows4 },
  ] as const

  return (
    <div className="flex min-h-dvh flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4">
        <SheetTitle isHidden>
          <Trans>Layouts</Trans>
        </SheetTitle>
        <div className="flex flex-col gap-2 phone:mt-auto">
          {options.map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant="ghost"
              className="h-auto min-h-11 justify-start gap-3 rounded-md bg-muted/50 px-3 py-2.5 text-base font-semibold hover:bg-muted/70"
              aria-pressed={layout === value}
              onClick={() => {
                onChoose(value)
              }}
            >
              <Icon className="size-5 text-muted-foreground" />
              {label}
              {layout === value && <Check className="ml-auto size-5 dark:text-sidebar-primary" />}
            </Button>
          ))}
        </div>
      </main>

      <BottomBar>
        <SheetBack onClick={onClose} title={<Trans>Layouts</Trans>} />
      </BottomBar>
    </div>
  )
}
