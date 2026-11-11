import type { ReactNode } from 'react'

type BottomBarProps = { children: ReactNode; notice?: ReactNode }

export default function BottomBar({ children, notice }: BottomBarProps) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t bg-background">
      {notice}
      <div className="mx-auto flex items-center">{children}</div>
    </nav>
  )
}

export function BottomBarTitle({ children }: { children: ReactNode }) {
  return <h1 className="px-2 font-medium text-muted-foreground">{children}</h1>
}
