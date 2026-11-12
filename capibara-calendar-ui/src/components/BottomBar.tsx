import { cn } from 'cn'
import type { ReactNode } from 'react'
import { usePhonePortrait } from '@/lib/use-phone-portrait'

type BottomBarProps = { children: ReactNode; notice?: ReactNode }

export default function BottomBar({ children, notice }: BottomBarProps) {
  const isPhone = usePhonePortrait()
  if (!isPhone) {
    return (
      <nav className="fixed inset-x-0 top-0 z-20 border-b bg-background [&_button]:rounded-none">
        <div className="relative mx-auto flex h-11 items-center">{children}</div>
        {notice}
      </nav>
    )
  }
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background [&_button]:rounded-none">
      {notice}
      <div className="mx-auto flex items-center">{children}</div>
    </nav>
  )
}

export function BottomBarTitle({
  children,
  isCentered = false,
}: {
  children: ReactNode
  // In the middle of the top bar, whatever the buttons that are on its sides.
  isCentered?: boolean
}) {
  return (
    <h1
      className={cn(
        'px-2 font-medium text-muted-foreground',
        isCentered && 'pointer-events-none absolute inset-x-0 text-center',
      )}
    >
      {children}
    </h1>
  )
}
