import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'

export function useScrollEdges(items: number, initialLeft = 0) {
  const node = useRef<HTMLElement | null>(null)
  const [element, setElement] = useState<HTMLElement | null>(null)
  const ref = useCallback((found: HTMLElement | null) => {
    node.current = found
    setElement(found)
  }, [])
  const [edges, setEdges] = useState({ left: false, right: false })

  const update = (scroller: HTMLElement) => {
    const left = scroller.scrollLeft > 1
    const right = scroller.scrollLeft + scroller.clientWidth < scroller.scrollWidth - 1
    setEdges((now) => (now.left === left && now.right === right ? now : { left, right }))
  }

  useLayoutEffect(() => {
    if (node.current && initialLeft) node.current.scrollLeft = initialLeft
  }, [element, initialLeft])

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
    ref,
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
