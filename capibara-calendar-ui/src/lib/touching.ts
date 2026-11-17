// A finger is on the screen from its touchstart until a moment after its end. The browsers that
// send a contextmenu event for a long press send it in that time, whatever pointer type it says.
let fingers = 0
let lastTouchEnd = 0
const grace = 600

const onTouchStart = (event: TouchEvent) => {
  fingers = event.touches.length
}
const onTouchEnd = (event: TouchEvent) => {
  fingers = event.touches.length
  lastTouchEnd = Date.now()
}

if (typeof window !== 'undefined') {
  window.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
  window.addEventListener('touchend', onTouchEnd, { capture: true, passive: true })
  window.addEventListener('touchcancel', onTouchEnd, { capture: true, passive: true })
}

export const isTouching = () => fingers > 0 || Date.now() - lastTouchEnd < grace
