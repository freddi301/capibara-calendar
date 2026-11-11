import type { RepeatEnding } from './event-schema'

export const fadeIn = 'animate-in fade-in duration-300 motion-reduce:animate-none'
export const slideDownIn =
  'animate-in fade-in slide-in-from-top-1 duration-300 motion-reduce:animate-none'
export const slideUpIn =
  'animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none'
export const slideMs = 300

/**
 * Where the extra input of each ending comes from and goes to. From the left when the repeat
 * ends or stops ending; between the two endings, up and down as in the list of the options:
 * the one below comes in from below, the one above from above.
 */
export function endingSides(now: RepeatEnding | undefined, before: RepeatEnding | undefined) {
  return {
    on: {
      from: before === 'after' ? ('top' as const) : ('left' as const),
      to: now === 'after' ? ('top' as const) : ('left' as const),
    },
    after: {
      from: before === 'on' ? ('bottom' as const) : ('left' as const),
      to: now === 'on' ? ('bottom' as const) : ('left' as const),
    },
  }
}
export type Side = 'left' | 'right' | 'top' | 'bottom'
// The classes are whole words, for the way that Tailwind finds them.
export const slides: Record<Side, { in: string; out: string }> = {
  left: {
    in: 'animate-in fade-in slide-in-from-left-4 duration-300 motion-reduce:animate-none',
    out: 'animate-out fade-out slide-out-to-left-4 fill-mode-forwards duration-300 motion-reduce:animate-none',
  },
  right: {
    in: 'animate-in fade-in slide-in-from-right-4 duration-300 motion-reduce:animate-none',
    out: 'animate-out fade-out slide-out-to-right-4 fill-mode-forwards duration-300 motion-reduce:animate-none',
  },
  top: {
    in: 'animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none',
    out: 'animate-out fade-out slide-out-to-top-2 fill-mode-forwards duration-300 motion-reduce:animate-none',
  },
  bottom: {
    in: 'animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none',
    out: 'animate-out fade-out slide-out-to-bottom-2 fill-mode-forwards duration-300 motion-reduce:animate-none',
  },
}

export const isMotionReduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const rollMs = 300
const rolls = {
  forward: {
    in: 'animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none',
    out: 'animate-out fade-out slide-out-to-top-2 fill-mode-forwards duration-300 motion-reduce:hidden',
  },
  back: {
    in: 'animate-in fade-in slide-in-from-top-2 duration-300 motion-reduce:animate-none',
    out: 'animate-out fade-out slide-out-to-bottom-2 fill-mode-forwards duration-300 motion-reduce:hidden',
  },
}

export const rollFor = (isForward: boolean) => (isForward ? rolls.forward : rolls.back)
