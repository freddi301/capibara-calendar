import { useRef, type MouseEvent, type PointerEvent } from 'react'

const minDistance = 40

// Something inside that scrolls sideways keeps the swipes that start on it.
function scrollsSideways(target: EventTarget, container: Element) {
  for (
    let element = target instanceof Element ? target : null;
    element && element !== container;
    element = element.parentElement
  ) {
    const { overflowX } = getComputedStyle(element)
    if (
      (overflowX === 'auto' || overflowX === 'scroll') &&
      element.scrollWidth > element.clientWidth
    )
      return true
  }
  return false
}

/** Props for an element that reports sideways swipes: 1 towards the next, -1 towards the previous. */
export function useSwipe(onSwipe: (direction: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  const swiped = useRef(false)

  return {
    onPointerDown(event: PointerEvent<HTMLElement>) {
      swiped.current = false
      start.current = scrollsSideways(event.target, event.currentTarget)
        ? null
        : { x: event.clientX, y: event.clientY }
    },
    onPointerUp(event: PointerEvent<HTMLElement>) {
      const from = start.current
      start.current = null
      if (!from) return
      const dx = event.clientX - from.x
      const dy = event.clientY - from.y
      if (Math.abs(dx) > minDistance && Math.abs(dx) > Math.abs(dy)) {
        swiped.current = true
        onSwipe(dx < 0 ? 1 : -1)
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
