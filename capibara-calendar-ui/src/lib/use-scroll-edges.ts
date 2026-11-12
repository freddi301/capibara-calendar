import { useEffect, useState } from 'react'

/** Whether a row that scrolls sideways has more beyond its left edge and its right edge. */
export function useScrollEdges(items: number) {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [edges, setEdges] = useState({ left: false, right: false })

  const update = (scroller: HTMLElement) => {
    const left = scroller.scrollLeft > 1
    const right = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1
    setEdges((now) => (now.left === left && now.right === right ? now : { left, right }))
  }

  // When the cards or the width change, what is beyond the edges changes too: it is told when it begins to
  // watch, and each time that the size changes.
  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      update(element)
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [element, items])

  return {
    ref: setElement,
    edges,
    onScroll: (event: { currentTarget: HTMLElement }) => {
      update(event.currentTarget)
    },
    // One screen of the row to the side: the cards stop at their edges, as with the finger.
    scrollPage: (direction: -1 | 1) => {
      element?.scrollBy({ left: direction * element.clientWidth, behavior: 'smooth' })
    },
  }
}
