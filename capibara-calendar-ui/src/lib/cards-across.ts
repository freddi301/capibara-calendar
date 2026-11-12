import { useEffect, useState } from 'react'

// What a day row has beside its cards: the name and the number of the day, the gap and the padding.
const besideCards = 60
// The width that a card is about to have: the cards of a row are as many as fit, and share the width.
const aboutWidth = 220

/** How many cards are across in a row of the width: two at least, and as many as fit at about the width. */
export const cardsFor = (rowWidth: number) =>
  Math.max(2, Math.ceil((rowWidth - besideCards) / aboutWidth))

/** The number of cards across, from the width of the element that the rows are in. */
export function useCardsAcross() {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [cards, setCards] = useState(() => cardsFor(window.innerWidth))

  useEffect(() => {
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      setCards(cardsFor(entry.contentRect.width))
    })
    observer.observe(element)
    return () => {
      observer.disconnect()
    }
  }, [element])

  return { ref: setElement, cards }
}
