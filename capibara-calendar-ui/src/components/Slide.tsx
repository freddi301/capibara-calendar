import { cn } from 'cn'
import { useEffect, useState, type ReactNode } from 'react'
import { isMotionReduced, slideMs, slides, type Side } from '@/lib/motion'

type SlideProps = {
  show: boolean
  from: Side
  to?: Side
  className?: string
  children: ReactNode
}

export default function Slide({ show, from, to = from, className, children }: SlideProps) {
  const [isInitial] = useState(show)
  const [isChanged, setChanged] = useState(false)
  if (show !== isInitial && !isChanged) setChanged(true)
  const [isKept, setKept] = useState(show)
  if (show && !isKept) setKept(true)

  useEffect(() => {
    if (show) return
    const timer = window.setTimeout(
      () => {
        setKept(false)
      },
      isMotionReduced() ? 0 : slideMs,
    )
    return () => {
      window.clearTimeout(timer)
    }
  }, [show])

  if (!show && !isKept) return null
  return (
    <div
      inert={!show}
      className={cn(isChanged && (show ? slides[from].in : slides[to].out), className)}
    >
      {children}
    </div>
  )
}
