import { useRef, type TouchEvent } from 'react'

const pagerSelector = '[data-slot="pager"]'
const minDistance = 60
const horizontalness = 2

export function useSwipe(onSwipe?: (direction: 1 | -1) => void) {
  const start = useRef<{ x: number; y: number } | undefined>(undefined)
  return {
    onTouchStart: (event: TouchEvent) => {
      const touch = event.touches.item(0)
      const isInPager = event.target instanceof Element && event.target.closest(pagerSelector)
      start.current =
        event.touches.length === 1 && !isInPager
          ? { x: touch.clientX, y: touch.clientY }
          : undefined
    },
    onTouchEnd: (event: TouchEvent) => {
      const from = start.current
      start.current = undefined
      const touch = event.changedTouches.item(0)
      if (!onSwipe || !from) return
      const across = touch.clientX - from.x
      const down = touch.clientY - from.y
      if (Math.abs(across) < minDistance || Math.abs(across) < horizontalness * Math.abs(down))
        return
      onSwipe(across < 0 ? 1 : -1)
    },
    onTouchCancel: () => {
      start.current = undefined
    },
  }
}
