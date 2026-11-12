import { useLingui } from '@lingui/react/macro'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { cn } from 'cn'
import { Eye, LayoutGrid, ListFilter, Plus, RefreshCw, Settings } from 'lucide-react'
import type { ReactNode } from 'react'
import BottomBar from '@/components/BottomBar'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { resetApi } from '@/api'
import { refreshEvents } from '@/lib/event-chunks'
import { useHasServerError } from '@/lib/use-server-error'
import { usePhonePortrait } from '@/lib/use-phone-portrait'

type ListButtons = {
  onOpenSettings: () => void
  onOpenLayouts: () => void
  onOpenView: () => void
  onOpenFilter: () => void
  onCreate: () => void
}

export function ListStartActions({ onOpenSettings }: Pick<ListButtons, 'onOpenSettings'>) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const isRefreshing = useIsFetching() > 0
  const hasServerError = useHasServerError()
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
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant="ghost"
              className="relative size-11 text-muted-foreground"
              aria-label={t`Refresh`}
              aria-busy={isRefreshing}
              onClick={() => {
                resetApi()
                void queryClient.invalidateQueries({ queryKey: ['calendars'] })
                void refreshEvents(queryClient)
              }}
            />
          }
        >
          <RefreshCw className={cn('size-6', isRefreshing && 'animate-spin')} />
          {hasServerError && (
            <span
              aria-hidden="true"
              className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-destructive ring-2 ring-background"
            />
          )}
        </TooltipTrigger>
        {hasServerError && <TooltipContent>{t`Cannot reach the CalDAV server`}</TooltipContent>}
      </Tooltip>
    </>
  )
}

export function ListEndActions({
  onOpenLayouts,
  onOpenView,
  onOpenFilter,
  onCreate,
  isSpread = false,
}: Omit<ListButtons, 'onOpenSettings'> & { isSpread?: boolean }) {
  const { t } = useLingui()
  return (
    <>
      <Button
        variant="ghost"
        className={cn('size-11 text-muted-foreground', isSpread && 'ml-auto')}
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
        className="size-11 text-muted-foreground"
        aria-label={t`Filter`}
        onClick={onOpenFilter}
      >
        <ListFilter className="size-6" />
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
