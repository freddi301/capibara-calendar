import { useLingui } from '@lingui/react/macro'
import { useIsFetching, useQueryClient } from '@tanstack/react-query'
import { cn } from 'cn'
import { LayoutGrid, ListFilter, Plus, RefreshCw, Settings } from 'lucide-react'
import BottomBar from '@/components/BottomBar'
import { Button } from '@/components/ui/button'
import { resetConnection } from '@/lib/caldav'

type ListBottomBarProps = {
  onOpenSettings: () => void
  onOpenLayouts: () => void
  onOpenFilter: () => void
  onCreate: () => void
}

export default function ListBottomBar({
  onOpenSettings,
  onOpenLayouts,
  onOpenFilter,
  onCreate,
}: ListBottomBarProps) {
  const { t } = useLingui()
  const queryClient = useQueryClient()
  const isRefreshing = useIsFetching() > 0
  return (
    <BottomBar>
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
          // What the server has now: the calendars and their colors too, not only the events.
          resetConnection()
          void queryClient.invalidateQueries()
        }}
      >
        <RefreshCw className={cn('size-6', isRefreshing && 'animate-spin')} />
      </Button>
      <Button
        variant="ghost"
        className="ml-auto size-11 text-muted-foreground"
        aria-label={t`Layouts`}
        onClick={onOpenLayouts}
      >
        <LayoutGrid className="size-6" />
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
    </BottomBar>
  )
}
