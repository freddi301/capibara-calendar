import type { Page } from '@playwright/test'
import { expect, test } from './seeded.ts'

// The columns of events that the developer chose in the layout review, for each layout and viewport
// of LAYOUT-MATRIX.md. The tests that use them run on the stress data, in Italian.

export const viewports = {
  portrait: { width: 412, height: 915 },
  landscape: { width: 915, height: 412 },
  half: { width: 960, height: 1000 },
  desktop: { width: 1920, height: 1080 },
}

export type ViewportName = keyof typeof viewports

/** The names of the layouts in the layout switcher, in Italian. */
export const layoutNames = {
  week: 'Settimana',
  month: 'Mese',
  timelineDay: 'Timeline giorno',
  timelineWeek: 'Timeline settimana',
  timelineMonth: 'Timeline mese',
}

/** Opens the stress data on the layout. The agenda is the one that the app starts on. */
export async function openStress(page: Page, layout?: keyof typeof layoutNames) {
  await page.goto('/?seed=stress')
  if (!layout) return
  await page.getByRole('button', { name: 'Visualizzazioni' }).click()
  await page.getByRole('button', { name: layoutNames[layout], exact: true }).click()
}

/**
 * A test for each viewport that the layout has: the columns that it shows there. The viewports that
 * are left out are the ones where the layout is not shown.
 */
export function testColumns(
  row: string,
  columns: Partial<Record<ViewportName, number>>,
  open: (page: Page) => Promise<void>,
  measure: (page: Page) => Promise<number>,
) {
  for (const [name, expected] of Object.entries(columns) as [ViewportName, number][]) {
    test.describe(`${row}, ${name}`, () => {
      test.use({ viewport: viewports[name] })

      test(`shows ${String(expected)} column(s) of events`, async ({ page }) => {
        // given
        await open(page)

        // when
        const shown = await measure(page)

        // then
        expect(shown).toBe(expected)
      })
    })
  }
}

/** The columns of the agenda: the most that the events of a day have, side by side. */
export async function agendaColumns(page: Page) {
  const items = page.locator('[data-slot="lanes"] > *')
  await expect(items.first()).toBeVisible()
  return page
    .locator('[data-slot="lanes"]')
    .evaluateAll((lanes) =>
      Math.max(
        ...lanes.map(
          (lane) =>
            new Set([...lane.children].map((item) => Math.round(item.getBoundingClientRect().x)))
              .size,
        ),
      ),
    )
}

/** The columns of the rows of the week: the most cards that a row shows whole, without scrolling. */
export async function rowsColumns(page: Page) {
  const rows = page.locator('.snap-x')
  await expect(rows.getByRole('button').first()).toBeVisible() // some rows have no events
  return rows.evaluateAll((scrollers) =>
    Math.max(
      ...scrollers.map((scroller) => {
        const row = scroller.getBoundingClientRect()
        // The cards are inside wrappers that have no box of their own.
        return [...scroller.querySelectorAll('button')].filter((card) => {
          const box = card.getBoundingClientRect()
          return box.width > 0 && box.left >= row.left - 1 && box.right <= row.right + 1
        }).length
      }),
    ),
  )
}

/** The columns of a timeline: how many blocks, side by side, fit in the width that is seen. */
export async function timelineColumns(page: Page) {
  const blocks = page.locator('[data-slot=timeline-block]')
  await expect(blocks.first()).toBeVisible()
  return blocks.first().evaluate((block) => {
    // A block is as wide as one column of the width that is seen, and starts where its lane starts.
    const lane = (block as HTMLElement).offsetParent as HTMLElement
    const seen = (lane.closest('[data-slot=timeline]') as HTMLElement).parentElement as HTMLElement
    return Math.round(
      (seen.getBoundingClientRect().right - lane.getBoundingClientRect().left) /
        block.getBoundingClientRect().width,
    )
  })
}

/** The columns of the events inside the day cells of the month: the most that a cell has. */
export async function monthColumns(page: Page) {
  const cells = page.getByRole('gridcell')
  await expect(cells.locator('.snap-y').getByRole('button').first()).toBeVisible()
  return cells.evaluateAll((all) =>
    Math.max(
      ...all.map((cell) => {
        // The cards are the buttons of the list that scrolls inside the cell: the dots beside it
        // and the button that creates an event are buttons too, and the pager around is a list.
        const cards = [...cell.querySelectorAll('button')].filter((button) => {
          const list = button.closest('.snap-y')
          return list && cell.contains(list)
        })
        return new Set(cards.map((card) => Math.round(card.getBoundingClientRect().x))).size
      }),
    ),
  )
}
