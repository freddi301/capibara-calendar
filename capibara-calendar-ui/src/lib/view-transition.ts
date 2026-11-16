import { flushSync } from 'react-dom'
import { isMotionReduced } from './motion'

export type Motion =
  { kind: 'enter' | 'leave'; page: string } | { kind: 'toggle' } | { kind: 'move' }

let running = 0

export function withViewTransition(change: () => void, motion?: Motion) {
  if (!('startViewTransition' in document) || isMotionReduced()) {
    change()
    return
  }
  const root = document.documentElement
  const id = ++running
  const clear = () => {
    if (id !== running) return
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

const settleMs = 60

const settled = () =>
  new Promise<void>((resolve) => {
    window.setTimeout(resolve, settleMs)
  })

export async function withSettledViewTransition(
  change: () => void,
  motion: 'move' | 'fade' = 'move',
) {
  if (!('startViewTransition' in document) || isMotionReduced()) {
    change()
    return
  }
  // What is in both states glides to where it goes, and what is in one of them fades.
  const root = document.documentElement
  const id = ++running
  if (motion === 'move') root.dataset.motion = 'move'
  const transition = document.startViewTransition(async () => {
    change()
    await settled()
  })
  await transition.finished.catch(() => undefined)
  if (id === running) delete root.dataset.motion
}
