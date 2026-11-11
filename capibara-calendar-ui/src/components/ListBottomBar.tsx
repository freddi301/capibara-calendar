import { useLingui } from '@lingui/react/macro'
import { LayoutGrid, Plus, Settings } from 'lucide-react'
import BottomBar from '@/components/BottomBar'
import { Button } from '@/components/ui/button'

type ListBottomBarProps = {
  onOpenSettings: () => void
  onOpenLayouts: () => void
  onCreate: () => void
}

export default function ListBottomBar({
  onOpenSettings,
  onOpenLayouts,
  onCreate,
}: ListBottomBarProps) {
  const { t } = useLingui()
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
        className="ml-auto size-11 text-muted-foreground"
        aria-label={t`Layouts`}
        onClick={onOpenLayouts}
      >
        <LayoutGrid className="size-6" />
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
