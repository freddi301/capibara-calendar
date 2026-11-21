import { center, drag, showMonth } from '../support/app.ts'
import { expect, test } from '../support/seeded.ts'

test.describe('agenda, month table, mobile portrait', () => {
  test.use({ viewport: { width: 412, height: 915 } })

  test('pages the month and the one before with a swipe, without choosing a day', async ({
    page,
  }) => {
    // given
    await page.goto('/?seed=realistic')
    await showMonth(page)
    const date = page.getByLabel('Choose a date')
    const today = await date.inputValue()
    const table = await center(page, 'Month')
    const first = () =>
      page
        .getByRole('group', { name: 'Month', exact: true })
        .getByRole('button')
        .first()
        .evaluate((button) => button.textContent)
    const thisMonth = await first()

    // when
    await drag(page, [table.x, table.y + table.height / 3], [table.x, table.y - table.height / 3])

    // then
    await expect.poll(first).not.toBe(thisMonth)
    await expect(date).toHaveValue(today)

    // when
    await drag(page, [table.x, table.y - table.height / 3], [table.x, table.y + table.height / 3])

    // then
    await expect.poll(first).toBe(thisMonth)
    await expect(date).toHaveValue(today)
  })
})
