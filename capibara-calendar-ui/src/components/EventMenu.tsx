import { Trans } from '@lingui/react/macro'
import { cn } from 'cn'
import { Ban, Check, Copy, RotateCcw, Trash2, X } from 'lucide-react'
import { Fragment, useRef, useState, type ReactNode } from 'react'
import type { CalendarEvent } from '@/api/calendar-api'
import { Button } from '@/components/ui/button'
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@/components/ui/context-menu'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { fromBottom, hasActions } from '@/lib/event-actions'
import { useEventActions } from '@/lib/use-event-actions'
import { isTouching } from '@/lib/touching'
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
const sheetLook = cn('gap-0 rounded-t-xl py-2')
const sheetGroup = cn('flex flex-col')
const sheetGroupAfter = cn('flex flex-col border-t pt-1')

/** A controlled card (it is lifted by a long press) opens its menu by itself only for a right click: the finger that lifts it opens the menu when it is let go. */
const isRightClick = (event: Event) => {
  const { pointerType } = event as PointerEvent
  return event.type === 'contextmenu' && pointerType !== 'touch' && pointerType !== 'pen'
}

const longPress = 500
const pressTolerance = 10
type Press = { x: number; y: number; time: number }

export default function EventMenu({ event, children, isOpen, onClose }: EventMenuProps) {
  const { rules, answer, toggleCancel, remove, duplicate, scopeDialog } = useEventActions(event)
  const [isOwnOpen, setOwnOpen] = useState(false)
  const press = useRef<Press>(undefined)
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
          // A finger never opens the menu while it is down: it opens when the finger is let go.
          if (isTouching() || (isControlled && !isRightClick(details.event))) return
          setOwnOpen(true)
        }}
      >
        <ContextMenuTrigger
          className="contents"
          onTouchStart={(event) => {
            const { clientX: x, clientY: y } = event.touches[0]
            press.current = event.touches.length === 1 ? { x, y, time: Date.now() } : undefined
          }}
          onTouchMove={(event) => {
            const { clientX, clientY } = event.touches[0]
            const start = press.current
            if (start && Math.hypot(clientX - start.x, clientY - start.y) > pressTolerance)
              press.current = undefined
          }}
          onTouchEnd={(event) => {
            const start = press.current
            press.current = undefined
            if (isControlled || !start || Date.now() - start.time < longPress) return
            if (event.cancelable) event.preventDefault() // the tap that follows would open the event
            setOwnOpen(true)
          }}
          onTouchCancel={() => {
            press.current = undefined
          }}
        >
          {children}
        </ContextMenuTrigger>
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
            <SheetTitle className="sr-only">{event.title}</SheetTitle>
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
