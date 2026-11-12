import { useCallback, useEffect, useRef, useState } from 'react'

export function useElementSize() {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    if (!element) return
    const measure = () => {
      setSize((now) =>
        now.width === element.clientWidth && now.height === element.clientHeight
          ? now
          : { width: element.clientWidth, height: element.clientHeight },
      )
    }
    measure()
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [element])

  return { ref: setElement, ...size }
}

export function useScroller() {
  const ref = useRef<HTMLDivElement>(null)
  const scrollTo = useCallback((top: number) => {
    if (ref.current) ref.current.scrollTop = top
  }, [])
  return { ref, scrollTo }
}
