import { describe, expect, it } from 'vitest'
import { cardsFor, type CardsLayout } from '@/lib/cards-across'

// The widths of the viewports of LAYOUT-MATRIX.md, and the columns that the developer chose.
const chosen: Record<
  CardsLayout,
  [portrait: number, landscape: number, half: number, desktop: number]
> = {
  rows: [2, 2, 4, 6],
  day: [2, 4, 4, 6],
  week: [2, 3, 4, 6],
  month: [2, 3, 4, 6],
}
const widths = [412, 915, 960, 1920]

describe('cardsFor', () => {
  for (const [layout, columns] of Object.entries(chosen) as [CardsLayout, number[]][]) {
    it(`gives the ${layout} the columns that were chosen at each viewport`, () => {
      // given
      const found = widths.map((width) => cardsFor(layout, width))

      // then
      expect(found).toEqual(columns)
    })
  }

  it('changes the columns at the breakpoints: md (768), half (960) and 2xl (1536), and not before', () => {
    // then
    expect([767, 768].map((width) => cardsFor('day', width))).toEqual([2, 4])
    expect([767, 768, 959, 960].map((width) => cardsFor('week', width))).toEqual([2, 3, 3, 4])
    expect([959, 960].map((width) => cardsFor('rows', width))).toEqual([2, 4])
    for (const layout of ['rows', 'day', 'week', 'month'] as const) {
      expect([1535, 1536].map((width) => cardsFor(layout, width))).toEqual([
        cardsFor(layout, 1280),
        6,
      ])
    }
  })

  it('has two columns at least, whatever the width', () => {
    // then
    expect(cardsFor('week', 0)).toBe(2)
    expect(cardsFor('rows', 320)).toBe(2)
  })
})
