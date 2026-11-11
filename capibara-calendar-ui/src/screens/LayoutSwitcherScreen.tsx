import { Trans, useLingui } from '@lingui/react/macro'
import { ArrowLeft, CalendarDays, CalendarRange, Check, List, Rows3 } from 'lucide-react'
import BottomBar from '@/components/BottomBar'
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
    { value: 'week', label: t`Week`, icon: CalendarRange },
    { value: 'weekRows', label: t`Week rows`, icon: Rows3 },
    { value: 'month', label: t`Month`, icon: CalendarDays },
    { value: 'agenda', label: t`Agenda`, icon: List },
  ] as const

  return (
    <>
      <main className="mx-auto flex min-h-screen max-w-md flex-col gap-4 p-4 pb-16">
        <h1 className="text-2xl font-bold text-muted-foreground">
          <Trans>Layouts</Trans>
        </h1>
        <div className="flex flex-col gap-2">
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
        <Button
          variant="ghost"
          className="size-11 text-muted-foreground"
          aria-label={t`Back`}
          onClick={onClose}
        >
          <ArrowLeft />
        </Button>
      </BottomBar>
    </>
  )
}
