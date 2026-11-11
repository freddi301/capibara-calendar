import { act, fireEvent } from '@testing-library/react'

const size = 300
const sized = new WeakSet<HTMLElement>()

/** The pager of an element that is in one of its pages. */
export const pagerOf = (element: HTMLElement) =>
  element.closest<HTMLElement>('[data-slot="pager"]') as HTMLElement

// A pager has no size in jsdom: say how big its pages are, and keep where it is scrolled to.
export function sizePager(pager: HTMLElement) {
  if (sized.has(pager)) return
  sized.add(pager)
  let left = size
  let top = size
  Object.defineProperties(pager, {
    clientWidth: { value: size, configurable: true },
    clientHeight: { value: size, configurable: true },
    scrollLeft: {
      get: () => left,
      set: (value: number) => {
        left = value
      },
      configurable: true,
    },
    scrollTop: {
      get: () => top,
      set: (value: number) => {
        top = value
      },
      configurable: true,
    },
  })
}

/** Scrolls to a page, 0 the one before, 1 the one that is shown and 2 the one after, and stops. */
export async function scrollToPage(pager: HTMLElement, axis: 'x' | 'y', page: 0 | 1 | 2) {
  sizePager(pager)
  if (axis === 'x') pager.scrollLeft = page * size
  else pager.scrollTop = page * size
  fireEvent.scroll(pager)
  // It has stopped when it has not moved for a moment.
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 160))
  })
}
