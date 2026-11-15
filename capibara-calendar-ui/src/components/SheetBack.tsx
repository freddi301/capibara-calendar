import { useLingui } from '@lingui/react/macro'
import { cn } from 'cn'
import { ChevronDown, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { BottomBarTitle } from '@/components/BottomBar'
import { Button } from '@/components/ui/button'
import { usePhonePortrait } from '@/lib/use-phone-portrait'

export default function SheetBack({ onClick, title }: { onClick: () => void; title: ReactNode }) {
  const { t } = useLingui()
  const isPhone = usePhonePortrait()
  if (isPhone) {
    return (
      <Button
        variant="ghost"
        className="h-11 w-full text-muted-foreground"
        aria-label={t`Back`}
        onClick={onClick}
      >
        <ChevronDown className="size-6" />
      </Button>
    )
  }
  return (
    <>
      <BottomBarTitle isCentered>{title}</BottomBarTitle>
      <Button
        variant="ghost"
        className="ml-auto size-11 text-muted-foreground"
        aria-label={t`Close`}
        onClick={onClick}
      >
        <X className="size-6" />
      </Button>
    </>
  )
}

/** The heading of a screen on a phone in portrait. Hidden, it is still there for who reads the screen with a reader. */
export function SheetTitle({
  children,
  isHidden = false,
}: {
  children: ReactNode
  isHidden?: boolean
}) {
  if (!usePhonePortrait()) return null
  return (
    <h1
      className={cn('text-center text-2xl font-bold text-muted-foreground', isHidden && 'sr-only')}
    >
      {children}
    </h1>
  )
}
