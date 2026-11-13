import { Cloud, HardDrive, MemoryStick, MessagesSquare, type LucideIcon } from 'lucide-react'
import { cn } from 'cn'
import type { SourceKind } from '@/api/calendar-api'

const icons: Record<SourceKind, LucideIcon> = {
  caldav: Cloud,
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
