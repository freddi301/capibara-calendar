import type { LucideIcon } from 'lucide-react'

type EmptyStateProps = { icon: LucideIcon; title: string; hint: string }

export default function EmptyState({ icon: Icon, title, hint }: EmptyStateProps) {
  return (
    <div
      data-slot="empty-state"
      className="my-auto flex flex-col items-center gap-3 px-6 pb-6 text-center"
    >
      <span className="flex size-16 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <Icon className="size-8" />
      </span>
      <div className="flex flex-col gap-1">
        <p className="text-lg font-semibold">{title}</p>
        <p className="text-sm text-foreground/70">{hint}</p>
      </div>
    </div>
  )
}
