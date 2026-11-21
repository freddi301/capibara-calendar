import { openStress, testColumns, timelineColumns } from '../support/columns.ts'
import { expect, test } from '../support/seeded.ts'

testColumns(
  'timeline day',
  { portrait: 2, landscape: 4, half: 4, desktop: 6 },
  (page) => openStress(page, 'timelineDay'),
  timelineColumns,
)

test.describe('timeline day, mobile portrait', () => {
  test.use({ viewport: { width: 412, height: 915 } })

  test('puts the events that overlap side by side, each as high as a line of its title', async ({
    page,
  }) => {
    // given: the stress data (in Italian) has four events at 10:00 that last 30 minutes to 3 hours
    await page.goto('/?seed=stress')

    // when
    await page.getByRole('button', { name: 'Visualizzazioni' }).click()
    await page.getByRole('button', { name: 'Timeline giorno' }).click()

    // then
    const cards = page.locator('[data-slot=timeline]').getByRole('button')
    await expect(cards.first()).toBeVisible()
    const boxes = await cards.evaluateAll((elements) =>
      elements.map((element) => element.getBoundingClientRect().toJSON() as DOMRect),
    )
    expect(boxes.length).toBeGreaterThan(3)
    for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(40)
    for (const [index, one] of boxes.entries()) {
      for (const two of boxes.slice(index + 1)) {
        const sameTime = one.y < two.y + two.height - 1 && two.y < one.y + one.height - 1
        const sameColumn = one.x < two.x + two.width - 1 && two.x < one.x + one.width - 1
        expect(sameTime && sameColumn, 'two events on top of each other').toBe(false)
      }
    }
  })
})
