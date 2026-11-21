import type { Page } from '@playwright/test'
import { agendaColumns, openStress, testColumns, viewports } from '../support/columns.ts'
import { expect, test } from '../support/seeded.ts'

// The layouts that the developer approved in LAYOUT-MATRIX.md, so that they survive changes.

async function openLayout(page: Page, layout: string) {
  await page.getByRole('button', { name: 'Layouts' }).click()
  await page.getByRole('button', { name: layout }).click()
}

testColumns(
  'agenda',
  { portrait: 1, landscape: 2, half: 2, desktop: 3 },
  (page) => openStress(page),
  agendaColumns,
)

test.describe('agenda, date line, mobile portrait', () => {
  test.use({ viewport: viewports.portrait })

  test('keeps the date and the week in place: only the events scroll', async ({ page }) => {
    // given
    await page.goto('/?seed=realistic')
    await openLayout(page, 'Agenda')
    const week = page.getByRole('group', { name: 'Week' })
    await expect(week).toBeVisible()
    const top = (await week.boundingBox())?.y
    const list = page.locator('[data-vt="events"]')
    await expect(list).toHaveCSS('overflow-y', 'auto')

    // when
    await list.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })

    // then
    expect((await week.boundingBox())?.y).toBe(top)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= document.documentElement.clientHeight,
      ),
    ).toBe(true) // the page itself does not scroll
  })

  test('keeps the month where it is when the day goes from one digit to two', async ({ page }) => {
    // given
    await page.goto('/?seed=realistic')
    await openLayout(page, 'Agenda')
    const month = page.getByRole('combobox', { name: /^Month/ })
    const date = page.getByLabel('Choose a date')

    // when
    await date.fill('2026-12-09')
    const x = (await month.boundingBox())?.x

    // then
    await date.fill('2026-12-10')
    expect((await month.boundingBox())?.x).toBe(x)
    await date.fill('2026-12-31')
    expect((await month.boundingBox())?.x).toBe(x)
  })

  test('shows the date line following the scroll, and scrolls to a date that is chosen', async ({
    page,
  }) => {
    // given: a window as short as the list, so that there is something to scroll
    await page.setViewportSize({ width: viewports.portrait.width, height: 240 })
    await page.goto('/?seed=realistic')
    await openLayout(page, 'Agenda')
    const date = page.getByLabel('Choose a date')
    const first = await date.inputValue()
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()
    const list = page.locator('[data-vt="events"]')

    // when: scrolling to the end of the list
    await list.evaluate((element) => {
      element.dispatchEvent(new WheelEvent('wheel', { bubbles: true })) // the person is scrolling
      element.scrollTop = element.scrollHeight
    })

    // then: the date moves to a later day
    await expect.poll(async () => (await date.inputValue()) > first).toBe(true)

    // when: choosing a date brings the list to it. The first day is not the one that the scrolling
    // reached, so choosing it is a change.
    await date.fill(first)

    // then: its day is at the top
    await expect(date).toHaveValue(first)
    await expect
      .poll(() =>
        list.evaluate((element, day) => {
          const row = element.querySelector(`[data-day="${day}"]`)
          return row ? row.getBoundingClientRect().top - element.getBoundingClientRect().top : NaN
        }, first),
      )
      .toBeLessThan(2)
  })
})
