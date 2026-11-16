import { cn } from 'cn'
import {
  useLayoutEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
} from 'react'
import { pagerStyle } from '@/lib/pager-style'
import { isDragged } from '@/lib/pointer-type'

type SnapPagerProps = {
  axis: 'x' | 'y'
  centerKey: string
  onPage: (direction: 1 | -1) => void
  className?: string
  pages: [ReactNode, ReactNode, ReactNode]
}

const settleDelay = 120
const dragDistance = 40

export default function SnapPager({ axis, centerKey, onPage, className, pages }: SnapPagerProps) {
  const element = useRef<HTMLDivElement>(null)
  const timer = useRef<number | undefined>(undefined)
  const drag = useRef<{ from: number; scrolled: number; moved: boolean } | null>(null)
  const dragged = useRef(false)
  // Between the first movement and the rest: not when it is put back at the middle.
  const [isScrolling, setScrolling] = useState(false)
  const horizontal = axis === 'x'

  const size = (node: HTMLElement) => (horizontal ? node.clientWidth : node.clientHeight)
  const position = (node: HTMLElement) => (horizontal ? node.scrollLeft : node.scrollTop)
  const moveTo = (node: HTMLElement, value: number) => {
    if (horizontal) node.scrollLeft = value
    else node.scrollTop = value
  }
  const coordinate = (event: PointerEvent) => (horizontal ? event.clientX : event.clientY)

  useLayoutEffect(() => {
    const node = element.current
    if (node) moveTo(node, size(node))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerKey])

  const settle = () => {
    const node = element.current
    if (!node) return
    pagerStyle.reset(node)
    setScrolling(false)
    const length = size(node)
    if (!length) return
    const index = Math.round(position(node) / length)
    if (index !== 1) onPage(index < 1 ? -1 : 1)
  }

  const end = () => {
    const node = element.current
    const current = drag.current
    drag.current = null
    if (!node || !current?.moved) return
    dragged.current = true
    const travelled = position(node) - current.scrolled
    const page = travelled > dragDistance ? 2 : travelled < -dragDistance ? 0 : 1
    pagerStyle.release(node)
    moveTo(node, page * size(node))
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(settle, settleDelay)
  }

  return (
    <div
      ref={element}
      data-slot="pager"
      data-scrolling={isScrolling || undefined}
      className={cn(
        'relative flex snap-mandatory [scrollbar-width:none] overflow-auto overscroll-contain select-none [&::-webkit-scrollbar]:hidden',
        horizontal ? 'snap-x overflow-y-hidden' : 'snap-y flex-col overflow-x-hidden',
        className,
      )}
      onScroll={(event) => {
        setScrolling(position(event.currentTarget) !== size(event.currentTarget))
        window.clearTimeout(timer.current)
        if (!drag.current) timer.current = window.setTimeout(settle, settleDelay)
      }}
      onPointerDown={(event: PointerEvent<HTMLDivElement>) => {
        dragged.current = false
        if (!isDragged(event) || event.button !== 0) return
        if (event.target instanceof Element && event.target.closest('[data-pager-ignore]')) return
        drag.current = {
          from: coordinate(event),
          scrolled: position(event.currentTarget),
          moved: false,
        }
      }}
      onPointerMove={(event: PointerEvent<HTMLDivElement>) => {
        const current = drag.current
        if (!current) return
        const moved = coordinate(event) - current.from
        if (!current.moved && Math.abs(moved) < 4) return
        current.moved = true
        pagerStyle.free(event.currentTarget) // free while it is dragged
        moveTo(event.currentTarget, current.scrolled - moved)
      }}
      onPointerUp={end}
      onPointerLeave={end}
      onPointerCancel={() => {
        drag.current = null
      }}
      // The end of a drag over a button is not a tap on it.
      onClickCapture={(event: MouseEvent) => {
        if (!dragged.current) return
        dragged.current = false
        event.preventDefault()
        event.stopPropagation()
      }}
    >
      {pages.map((page, index) => (
        <div
          key={index}
          inert={index !== 1}
          aria-hidden={index === 1 ? undefined : true}
          className={cn('shrink-0 snap-center snap-always', horizontal ? 'w-full' : 'h-full')}
        >
          {page}
        </div>
      ))}
    </div>
  )
}
