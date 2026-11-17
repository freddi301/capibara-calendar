import { createEvent, fireEvent } from '@testing-library/react'

type Point = { clientX: number; clientY: number }

// jsdom has no touches: the event gets the lists that a browser gives it.
const touchList = (points: Point[]) =>
  Object.assign([...points], { item: (index: number) => points[index] ?? null })

export function fireTouch(
  type: 'touchStart' | 'touchEnd',
  element: Element,
  touches: Point[],
  changed: Point[],
) {
  const event = createEvent[type](element)
  Object.defineProperty(event, 'touches', { value: touchList(touches) })
  Object.defineProperty(event, 'changedTouches', { value: touchList(changed) })
  fireEvent(element, event)
}

/** One finger down at a point, and up at another one. */
export function dragFinger(element: Element, from: Point, to: Point) {
  fireTouch('touchStart', element, [from], [from])
  fireTouch('touchEnd', element, [], [to])
}

/** Two fingers down, as in a pinch: it is not a swipe. */
export function pinch(element: Element, first: Point, second: Point) {
  fireTouch('touchStart', element, [first, second], [first, second])
  fireTouch('touchEnd', element, [], [second])
}

export const at = (clientX: number, clientY = 300): Point => ({ clientX, clientY })
