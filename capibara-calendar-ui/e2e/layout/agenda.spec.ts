import { expect, test, type Page } from '@playwright/test'

// The layouts that the developer approved in LAYOUT-MATRIX.md, so that they survive changes.

const viewports = {
  portrait: { width: 412, height: 915 },
  landscape: { width: 915, height: 412 },
  half: { width: 960, height: 1000 },
  desktop: { width: 1920, height: 1080 },
}

async function openLayout(page: Page, layout: string) {
  await page.getByRole('button', { name: 'Layouts' }).click()
  await page.getByRole('button', { name: layout }).click()
}

/** The boxes of the event items, each with the box of the lanes that hold it. */
async function eventItems(page: Page) {
  const items = page.locator('[data-slot="lanes"] > *')
  await expect(items.first()).toBeVisible()
  return items.evaluateAll((elements) =>
    elements.map((element) => ({
      item: element.getBoundingClientRect().toJSON() as DOMRect,
      lanes: (element.parentElement as HTMLElement).getBoundingClientRect().toJSON() as DOMRect,
    })),
  )
}

test.describe('agenda, mobile portrait', () => {
  test.use({ viewport: viewports.portrait })

  test('each event takes the whole width of the list', async ({ page }) => {
    // given
    await page.goto('/?seed=realistic')

    // when
    await openLayout(page, 'Agenda')

    // then
    const boxes = await eventItems(page)
    expect(boxes.length).toBeGreaterThan(1)
    for (const { item, lanes } of boxes) {
      expect(item.x).toBeCloseTo(lanes.x, 0)
      expect(item.width).toBeCloseTo(lanes.width, 0)
    }
  })
})
