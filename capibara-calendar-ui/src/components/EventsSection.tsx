import type { ReactNode, Ref, UIEventHandler } from 'react'
import ServerError from '@/components/ServerError'

type EventsSectionProps = {
  isError: boolean
  onScroll?: UIEventHandler<HTMLElement>
  ref?: Ref<HTMLElement>
  children: ReactNode
}

export default function EventsSection({ isError, onScroll, ref, children }: EventsSectionProps) {
  return (
    <section
      ref={ref}
      data-vt="events"
      onScroll={onScroll}
      className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-2 pt-2 pb-16"
    >
      {isError && <ServerError />}
      {children}
    </section>
  )
}
