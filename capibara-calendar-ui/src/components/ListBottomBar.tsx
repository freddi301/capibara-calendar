import { useLingui } from '@lingui/react/macro'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { cn } from 'cn'
import { Calendars, Eye, LayoutGrid, ListFilter, Plus, RefreshCw, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import BottomBar from '@/components/BottomBar'
import { Button } from '@/components/ui/button'
import SyncErrors from '@/components/SyncErrors'
import { resetApi } from '@/api'
import { refreshEvents } from '@/lib/event-chunks'
import { countRules } from '@/lib/event-filter'
import { useCalendars } from '@/lib/use-calendars'
import { usePhonePortrait } from '@/lib/use-phone-portrait'
import { useStored } from '@/lib/use-stored'

type ListButtons = {
  onOpenSettings: () => void
  onOpenLayouts: () => void
  onOpenView: () => void
  onOpenCalendars: () => void
  onOpenFilters: () => void
  onCreate: () => void
}

export function ListStartActions({ onOpenSettings }: Pick<ListButtons, 'onOpenSettings'>) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const isRefreshing = useIsFetching() > 0
  return (
    <>
      <Button
        variant="ghost"
        className="size-11 text-muted-foreground"
        aria-label={t`Settings`}
        onClick={onOpenSettings}
      >
        <Settings className="size-6" />
      </Button>
      <Button
        variant="ghost"
        className="size-11 text-muted-foreground"
        aria-label={t`Refresh`}
        aria-busy={isRefreshing}
        onClick={() => {
          resetApi()
          void queryClient.invalidateQueries({ queryKey: ['calendars'] })
          void refreshEvents(queryClient)
        }}
      >
        <RefreshCw className={cn('size-6', isRefreshing && 'animate-spin')} />
      </Button>
      <SyncErrors />
    </>
  )
}

/** A small number on the corner of an icon. The words are in the title of the button. */
function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -top-0.5 -right-1.5 min-w-4 rounded-full bg-foreground px-1 text-center text-[10px] leading-4 font-semibold text-background ring-2 ring-background"
    >
      {children}
    </span>
  )
}

export function ListEndActions({
  onOpenLayouts,
  onOpenView,
  onOpenCalendars,
  onOpenFilters,
  onCreate,
  isSpread = false,
}: Omit<ListButtons, 'onOpenSettings'> & { isSpread?: boolean }) {
  const { t } = useLingui()
  const calendars = useCalendars()
  const rules = countRules(useStored((stored) => stored.eventFilter))
  const hidden = useStored((stored) => stored.hiddenCalendars)
  const total = calendars.data?.length ?? 0
  const shown = (calendars.data ?? []).filter(({ url }) => !hidden.includes(url)).length
  return (
    <>
      <Button
        variant="ghost"
        className={cn('relative size-11 text-muted-foreground', isSpread && 'ml-auto')}
        title={total > 0 ? t`${shown} of ${total} calendars shown` : undefined}
        onClick={onOpenCalendars}
      >
        <Calendars className="size-6" aria-hidden="true" />
        <span className="sr-only">{t`Calendars`}</span>
        {total > 0 && (
          <Badge>
            {shown}/{total}
          </Badge>
        )}
      </Button>
      <Button
        variant="ghost"
        className="size-11 text-muted-foreground"
        aria-label={t`Layouts`}
        onClick={onOpenLayouts}
      >
        <LayoutGrid className="size-6" />
      </Button>
      <Button
        variant="ghost"
        className="size-11 text-muted-foreground"
        aria-label={t`What to view`}
        onClick={onOpenView}
      >
        <Eye className="size-6" />
      </Button>
      <Button
        variant="ghost"
        className="relative size-11 text-muted-foreground"
        title={rules > 0 ? t`${rules} rules in the filter` : undefined}
        onClick={onOpenFilters}
      >
        <ListFilter className="size-6" aria-hidden="true" />
        <span className="sr-only">{t`Filter`}</span>
        {rules > 0 && <Badge>{rules}</Badge>}
      </Button>
      <Button
        variant="ghost"
        className="size-11 text-primary dark:text-sidebar-primary"
        aria-label={t`New event`}
        onClick={onCreate}
      >
        <Plus className="size-6" />
      </Button>
    </>
  )
}

export function ListActions(buttons: ListButtons) {
  return (
    <>
      <ListStartActions {...buttons} />
      <ListEndActions {...buttons} isSpread />
    </>
  )
}

export default function ListBottomBar({ children }: { children: ReactNode }) {
  if (!usePhonePortrait()) return null
  return <BottomBar>{children}</BottomBar>
}
