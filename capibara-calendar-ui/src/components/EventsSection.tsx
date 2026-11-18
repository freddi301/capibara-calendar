import type { ReactNode, Ref, UIEventHandler } from 'react'
import { useSwipe } from '@/lib/use-swipe'

type EventsSectionProps = {
  onScroll?: UIEventHandler<HTMLElement>
  onUserScroll?: () => void
  onSwipe?: (direction: 1 | -1) => void
  ref?: Ref<HTMLElement>
  children: ReactNode
}

export default function EventsSection({
  onScroll,
  onUserScroll,
  onSwipe,
  ref,
  children,
}: EventsSectionProps) {
  const swipe = useSwipe(onSwipe)
  return (
    <section
      ref={ref}
      data-vt="events"
      onScroll={onScroll}
      onWheel={onUserScroll}
      onTouchStart={onUserScroll}
      onTouchStartCapture={swipe.onTouchStart}
      onTouchEndCapture={swipe.onTouchEnd}
      onTouchCancelCapture={swipe.onTouchCancel}
      onPointerDown={onUserScroll}
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 pb-4"
    >
      {children}
    </section>
  )
}
