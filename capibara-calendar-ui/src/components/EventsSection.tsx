import type { ReactNode, Ref, UIEventHandler } from 'react'

type EventsSectionProps = {
  onScroll?: UIEventHandler<HTMLElement>
  onUserScroll?: () => void
  ref?: Ref<HTMLElement>
  children: ReactNode
}

export default function EventsSection({
  onScroll,
  onUserScroll,
  ref,
  children,
}: EventsSectionProps) {
  return (
    <section
      ref={ref}
      data-vt="events"
      onScroll={onScroll}
      onWheel={onUserScroll}
      onTouchStart={onUserScroll}
      onPointerDown={onUserScroll}
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pt-2 pb-4 phone:pb-16"
    >
      {children}
    </section>
  )
}
