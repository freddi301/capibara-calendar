export const fadeIn = 'animate-in fade-in duration-300 motion-reduce:animate-none'
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
