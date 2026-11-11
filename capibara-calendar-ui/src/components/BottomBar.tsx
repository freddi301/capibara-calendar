import type { ReactNode } from 'react'

export default function BottomBar({ children }: { children: ReactNode }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 border-t bg-background">
      <div className="mx-auto flex items-center">{children}</div>
    </nav>
  )
}

export function BottomBarTitle({ children }: { children: ReactNode }) {
  return <h1 className="px-2 font-medium text-muted-foreground">{children}</h1>
}
