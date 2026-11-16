import { Trans } from '@lingui/react/macro'
import { cn } from 'cn'
import { Ban, Check, Copy, RotateCcw, Trash2, X } from 'lucide-react'
import { Fragment, useState, type ReactNode } from 'react'
import type { CalendarEvent } from '@/api/calendar-api'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { fromBottom, hasActions } from '@/lib/event-actions'
import { useEventActions } from '@/lib/use-event-actions'
import { usePhonePortrait } from '@/lib/use-phone-portrait'

type EventMenuProps = {
  event: CalendarEvent
  children: ReactNode
  isOpen?: boolean
  onClose?: () => void
}

type Action = { icon: ReactNode; label: ReactNode; run: () => void; isDestructive?: boolean }

const sheetButton = cn('h-12 justify-start gap-3 px-4 text-base')
const sheetDanger = cn('h-12 justify-start gap-3 px-4 text-base text-destructive')
const sheetLook = cn('gap-0 rounded-t-xl pb-2')
const sheetGroup = cn('flex flex-col')
const sheetGroupAfter = cn('flex flex-col border-t pt-1')

export default function EventMenu({ event, children, isOpen, onClose }: EventMenuProps) {
  const { rules, answer, toggleCancel, remove, duplicate, scopeDialog } = useEventActions(event)
  const [isOwnOpen, setOwnOpen] = useState(false)
  const isPhone = usePhonePortrait()
  if (!hasActions(rules)) return <>{children}</>
  const isControlled = isOpen !== undefined
  const isShown = isOwnOpen || !!isOpen
  const close = () => {
    setOwnOpen(false)
    onClose?.()
  }

  // The groups are told apart by a line between them.
  const answers: Action[] = rules.answer
    ? [
        {
          icon: <Check aria-hidden="true" />,
          label: <Trans>Accept</Trans>,
          run: () => {
            answer('accepted')
          },
        },
        {
          icon: <X aria-hidden="true" />,
          label: <Trans>Decline</Trans>,
          run: () => {
            answer('declined')
          },
        },
      ]
    : []
  const others: Action[] = []
  if (rules.duplicate)
    others.push({
      icon: <Copy aria-hidden="true" />,
      label: <Trans>Duplicate</Trans>,
      run: duplicate,
    })
  if (rules.cancel === 'cancel')
    others.push({
      icon: <Ban aria-hidden="true" />,
      label: <Trans>Cancel event</Trans>,
      run: toggleCancel,
    })
  if (rules.cancel === 'restore')
    others.push({
      icon: <RotateCcw aria-hidden="true" />,
      label: <Trans>Restore</Trans>,
      run: toggleCancel,
    })
  if (rules.remove)
    others.push({
      icon: <Trash2 aria-hidden="true" />,
      label: <Trans>Delete</Trans>,
      run: remove,
      isDestructive: true,
    })
  const groups = [answers, others].filter((group) => group.length > 0)

  return (
    <>
      <ContextMenu
        open={isShown}
        onOpenChange={(open, details) => {
          if (!open) {
            close()
            return
          }
          if (isControlled && details.event.type !== 'contextmenu') return
          setOwnOpen(true)
        }}
      >
        <ContextMenuTrigger className="contents">{children}</ContextMenuTrigger>
        {!isPhone && (
          <ContextMenuContent>
            {groups.map((group, index) => (
              <Fragment key={index}>
                {index > 0 && <ContextMenuSeparator />}
                {group.map(({ icon, label, run, isDestructive }, at) => (
                  <ContextMenuItem
                    key={at}
                    variant={isDestructive ? 'destructive' : 'default'}
                    onClick={run}
                  >
                    {icon}
                    {label}
                  </ContextMenuItem>
                ))}
              </Fragment>
            ))}
          </ContextMenuContent>
        )}
      </ContextMenu>
      {isPhone && (
        <Sheet
          open={isShown}
          onOpenChange={(open) => {
            if (!open) close()
          }}
        >
          <SheetContent side={fromBottom} showCloseButton={false} className={sheetLook}>
            <SheetHeader>
              <SheetTitle className="line-clamp-2 text-base">{event.title}</SheetTitle>
            </SheetHeader>
            {groups.map((group, index) => (
              <div key={index} role="group" className={index > 0 ? sheetGroupAfter : sheetGroup}>
                {group.map(({ icon, label, run, isDestructive }, at) => (
                  <Button
                    key={at}
                    type="button"
                    variant="ghost"
                    className={isDestructive ? sheetDanger : sheetButton}
                    onClick={() => {
                      close()
                      run()
                    }}
                  >
                    {icon}
                    {label}
                  </Button>
                ))}
              </div>
            ))}
          </SheetContent>
        </Sheet>
      )}
      {scopeDialog}
    </>
  )
}
