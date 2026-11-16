import { Cloud, HardDrive, MemoryStick, MessagesSquare, Rss, type LucideIcon } from 'lucide-react'
import { cn } from 'cn'
import type { SourceKind } from '@/api/calendar-api'

const icons: Record<SourceKind, LucideIcon> = {
  caldav: Cloud,
  webcal: Rss,
  local: HardDrive,
  memory: MemoryStick,
  webxdc: MessagesSquare,
}

export default function SourceIcon({ kind, className }: { kind: SourceKind; className?: string }) {
  const Icon = icons[kind]
  return (
    <Icon aria-hidden="true" className={cn('size-3.5 shrink-0 text-muted-foreground', className)} />
  )
}

const urlBacked: SourceKind[] = ['caldav', 'webcal']

export function SourceTag({
  kind,
  name,
  className,
}: {
  kind: SourceKind
  name: string
  className?: string
}) {
  return (
    <span
      className={cn('flex min-w-0 shrink-0 items-center gap-2 text-muted-foreground', className)}
    >
      <span className={cn('min-w-0 truncate', !urlBacked.includes(kind) && 'sr-only')}>{name}</span>
      <SourceIcon kind={kind} />
    </span>
  )
}
