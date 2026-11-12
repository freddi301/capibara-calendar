import { useLingui } from '@lingui/react/macro'
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

export function SheetTitle({ children }: { children: ReactNode }) {
  if (!usePhonePortrait()) return null
  return <h1 className="text-center text-2xl font-bold text-muted-foreground">{children}</h1>
}
