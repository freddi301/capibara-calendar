import { cn } from 'cn'
import type { ReactNode } from 'react'

export default function RowLabel({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <span className={cn('text-right text-muted-foreground', className)}>{children}</span>
}
