import { Plus } from 'lucide-react'
import type { ReactNode } from 'react'
import type { SourceKind } from '@/api/calendar-api'
import SourceIcon from '@/components/SourceIcon'
import { Button } from '@/components/ui/button'

type SourceCardProps = {
  kind: SourceKind
  title: ReactNode
  description?: ReactNode
  control?: ReactNode
  children?: ReactNode
}

export default function SourceCard({
  kind,
  title,
  description,
  control,
  children,
}: SourceCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/50 p-3">
      <div className="flex items-center gap-3">
        <SourceIcon kind={kind} className="size-5" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-medium">{title}</span>
          {description && (
            <span className="min-w-0 text-sm break-words text-foreground/70">{description}</span>
          )}
        </div>
        {control}
      </div>
      {children}
    </div>
  )
}

export function AddSourceButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: ReactNode
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      className="h-9 w-fit gap-1 px-2 text-muted-foreground"
      onClick={onClick}
    >
      <Plus className="size-4" />
      {children}
    </Button>
  )
}
