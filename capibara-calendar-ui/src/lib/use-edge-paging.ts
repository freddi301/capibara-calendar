import { useEffect, useRef } from 'react'

const firstDelay = 600
const nextDelay = 2000
const rows = 7

export function useEdgePaging(isActive: boolean, onPage: (direction: 1 | -1) => void) {
  const latest = useRef(onPage)
  useEffect(() => {
    latest.current = onPage
  })

  useEffect(() => {
    if (!isActive) return
    let zone: -1 | 0 | 1 = 0
    let timer: number | undefined
    const wait = (delay: number) => {
      timer = window.setTimeout(() => {
        if (zone !== 0) latest.current(zone)
        wait(nextDelay)
      }, delay)
    }
    const check = (y: number) => {
      const box = document.querySelector('[data-slot="pager"]')?.getBoundingClientRect()
      const half = box ? box.height / rows / 2 : 0
      const next = !box ? 0 : y < box.top + half ? -1 : y > box.bottom - half ? 1 : 0
      if (next === zone) return
      zone = next
      window.clearTimeout(timer)
      if (zone !== 0) wait(firstDelay)
    }
    const onPointer = (event: PointerEvent) => {
      check(event.clientY)
    }
    const onTouch = (event: TouchEvent) => {
      if (event.touches.length > 0) check(event.touches[0].clientY)
    }
    window.addEventListener('pointermove', onPointer)
    window.addEventListener('touchmove', onTouch, { passive: true })
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointermove', onPointer)
      window.removeEventListener('touchmove', onTouch)
    }
  }, [isActive])
}
