import { useRef, type MouseEvent, type PointerEvent } from 'react'

const minDistance = 40

export type SwipeAxis = 'x' | 'y'

function scrolls(target: EventTarget, container: Element, axis: SwipeAxis) {
  for (
    let element = target instanceof Element ? target : null;
    element && element !== container;
    element = element.parentElement
  ) {
    const style = getComputedStyle(element)
    const overflow = axis === 'x' ? style.overflowX : style.overflowY
    const overflows =
      axis === 'x'
        ? element.scrollWidth > element.clientWidth
        : element.scrollHeight > element.clientHeight
    if ((overflow === 'auto' || overflow === 'scroll') && overflows) return true
  }
  return false
}

export function useSwipe(onSwipe: (direction: 1 | -1) => void, axis: SwipeAxis = 'x') {
  const start = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      swiped.current = false
      start.current = scrolls(event.target, event.currentTarget, axis)
        ? null
        : { x: event.clientX, y: event.clientY }
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const from = start.current
      start.current = null
      if (!from) return
      const along = axis === 'x' ? event.clientX - from.x : event.clientY - from.y
      const across = axis === 'x' ? event.clientY - from.y : event.clientX - from.x
      if (Math.abs(along) > minDistance && Math.abs(along) > Math.abs(across)) {
        swiped.current = true
        onSwipe(along < 0 ? 1 : -1)
      }
    },
    onPointerCancel() {
      start.current = null
    },
    // A swipe that ends on a button is not a tap on it.
    onClickCapture(event: MouseEvent<HTMLElement>) {
      if (!swiped.current) return
      swiped.current = false
      event.preventDefault()
      event.stopPropagation()
    },
  }
}
