import { cn } from 'cn'
import { useEffect, useState } from 'react'
import { rollFor, rollMs } from '@/lib/motion'

type RollingProps = { text: string; isForward: boolean }

export default function Rolling({ text, isForward }: RollingProps) {
  const [rolled, setRolled] = useState({ now: text, before: text })
  if (rolled.now !== text) setRolled({ now: text, before: rolled.now })
  const isRolling = rolled.before !== rolled.now
  const roll = rollFor(isForward)

  useEffect(() => {
    if (rolled.before === rolled.now) return
    const timer = window.setTimeout(() => {
      setRolled((current) => ({ ...current, before: current.now }))
    }, rollMs)
    return () => {
      window.clearTimeout(timer)
    }
  }, [rolled])

  return (
    <span className="relative inline-block whitespace-nowrap">
      {isRolling && (
        <span
          key={`out ${rolled.before}`}
          aria-hidden="true"
          className={cn('absolute inset-0', roll.out)}
        >
          {rolled.before}
        </span>
      )}
      <span key={rolled.now} className={cn(isRolling && roll.in)}>
        {rolled.now}
      </span>
    </span>
  )
}
