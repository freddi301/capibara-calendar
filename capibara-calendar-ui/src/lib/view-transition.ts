import { flushSync } from 'react-dom'
import { isMotionReduced } from './motion'

export type Motion = { kind: 'enter' | 'leave'; page: string } | { kind: 'toggle' }

let running = 0

export function withViewTransition(change: () => void, motion?: Motion) {
  if (!('startViewTransition' in document) || isMotionReduced()) {
    change()
    return
  }
  const root = document.documentElement
  const id = ++running
  const clear = () => {
    if (id !== running) return // another one has begun
    delete root.dataset.motion
    delete root.dataset.page
  }
  clear()
  if (motion) {
    root.dataset.motion = motion.kind
    if ('page' in motion) root.dataset.page = motion.page
  }
  const transition = document.startViewTransition(() => {
    flushSync(change)
  })
  void transition.finished.then(clear, clear)
}
