import {
  closestCenter,
  pointerWithin,
  type ClientRect,
  type CollisionDetection,
  type KeyboardCoordinateGetter,
} from '@dnd-kit/core'

const pagerBox = () => document.querySelector('[data-slot="pager"]')?.getBoundingClientRect()

const isShown = (rect: ClientRect | undefined, box: DOMRect | undefined): rect is ClientRect =>
  rect !== undefined && (!box || (rect.bottom > box.top && rect.top < box.bottom))

export const collideByPointerOrCenter: CollisionDetection = (args) => {
  const box = pagerBox()
  const { pointerCoordinates } = args
  if (box && pointerCoordinates) {
    const { x, y } = pointerCoordinates
    if (y < box.top || y > box.bottom || x < box.left || x > box.right) return []
  }
  const shown = args.droppableContainers.filter(({ id }) =>
    isShown(args.droppableRects.get(id), box),
  )
  const narrowed = { ...args, droppableContainers: shown }
  return pointerCoordinates ? pointerWithin(narrowed) : closestCenter(narrowed)
}

/** Enter opens the event, as it does for a button: the card is picked up and dropped with Space. */
export const keyboardCodes = { start: ['Space'], cancel: ['Escape'], end: ['Space'] }

/** The arrows move the card that is picked up to the day above or below, among the days that are shown. */
export const moveByDay: KeyboardCoordinateGetter = (
  event,
  { context: { droppableRects, droppableContainers, collisionRect }, currentCoordinates },
) => {
  const step = event.code === 'ArrowDown' ? 1 : event.code === 'ArrowUp' ? -1 : 0
  if (step === 0 || !collisionRect) return undefined
  event.preventDefault()
  const box = pagerBox()
  const rows = droppableContainers
    .getEnabled()
    .map(({ id }) => droppableRects.get(id))
    .filter(
      (rect): rect is ClientRect =>
        isShown(rect, box) && (!box || (rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1)),
    )
    .sort((a, b) => a.top - b.top)
  const middle = collisionRect.top + collisionRect.height / 2
  const here = rows.findIndex(({ top, height }) => middle >= top && middle < top + height)
  const next = here + step
  if (here < 0 || next < 0 || next >= rows.length) return undefined
  const target = rows[next]
  return { x: currentCoordinates.x, y: target.top + (target.height - collisionRect.height) / 2 }
}

export function translatedRect(measured: ClientRect | null, delta: { x: number }) {
  if (measured && measured.width > 0) return measured
  const node = document.querySelector('[data-dragging]')?.getBoundingClientRect()
  return node && { left: node.left + delta.x, width: node.width }
}
