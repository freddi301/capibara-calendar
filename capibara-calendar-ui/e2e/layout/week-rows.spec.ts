import { expect, test } from '@playwright/test'

// The layouts that the developer approved in LAYOUT-MATRIX.md, so that they survive changes.

test.describe('week rows, mobile portrait', () => {
  test.use({ viewport: { width: 412, height: 915 } })

  test('the duration bar fills the hours of the event on a 24 h scale, flush to the left edge', async ({
    page,
  }) => {
    // given: "Design review" is today, from 11:00 to 12:00
    await page.goto('/?seed=realistic')

    // when
    await page.getByRole('button', { name: 'Layouts' }).click()
    await page.getByRole('button', { name: 'Week', exact: true }).click()

    // then: the bar is measured against the inside of the card (its box without the borders)
    const card = page.getByRole('button', { name: /Design review/ }).first()
    await expect(card).toBeVisible()
    const { inside, fill } = await card.evaluate((element) => {
      const bar = element.querySelector('[data-slot="day-duration"]')
      if (!bar) throw new Error('the card has no duration bar')
      const box = element.getBoundingClientRect()
      return {
        inside: {
          x: box.x + element.clientLeft,
          y: box.y + element.clientTop,
          height: element.clientHeight,
        },
        fill: bar.getBoundingClientRect().toJSON() as DOMRect,
      }
    })
    expect(fill.x).toBeCloseTo(inside.x, 0)
    expect(fill.width).toBeCloseTo(4, 0)
    expect((fill.y - inside.y) / inside.height).toBeCloseTo(11 / 24, 2)
    expect(fill.height / inside.height).toBeCloseTo(1 / 24, 2)
  })
})
