import { useEffect, useState } from 'react'

// The widths where the cards across change. They are the `md` and `2xl` breakpoints of Tailwind,
// and `half` (`--breakpoint-half` in index.css): the same ones that the agenda uses for its lanes.
const md = 768
const half = 960
const wide = 1536

/** The cards across from a width on: each step holds from its width up to the next one. */
type Steps = readonly (readonly [fromWidth: number, cards: number])[]

const steps = {
  rows: [
    [0, 2],
    [half, 4],
    [wide, 6],
  ],
  day: [
    [0, 2],
    [md, 4],
    [wide, 6],
  ],
  week: [
    [0, 2],
    [md, 3],
    [half, 4],
    [wide, 6],
  ],
  month: [
    [0, 2],
    [md, 3],
    [half, 4],
    [wide, 6],
  ],
} as const satisfies Record<string, Steps>

/** The layouts that have cards across: the rows of the week, and the scales of the timeline. */
export type CardsLayout = keyof typeof steps

/** How many cards are across in a layout, from the width of the element that holds it. */
export const cardsFor = (layout: CardsLayout, width: number): number =>
  steps[layout].reduce((cards, [fromWidth, count]) => (width >= fromWidth ? count : cards), 2)

/** The number of cards across, from the width of the element that the rows are in. */
export function useCardsAcross(layout: CardsLayout) {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [cards, setCards] = useState(() => cardsFor(layout, window.innerWidth))

  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      setCards(cardsFor(layout, entry.contentRect.width))
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [element, layout])

  return { ref: setElement, cards }
}
