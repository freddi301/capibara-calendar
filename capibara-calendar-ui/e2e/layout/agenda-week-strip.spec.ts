import { center, drag } from '../support/app.ts'
import { expect, test } from '../support/seeded.ts'

test.describe('agenda, week strip, mobile portrait', () => {
  test.use({ viewport: { width: 412, height: 915 } })

  test('pages the week and the one before with a swipe, without choosing a day', async ({
    page,
  }) => {
    // given
    await page.goto('/?seed=realistic')
    const week = page.getByRole('group', { name: 'Week', exact: true })
    await expect(week).toBeVisible()
    const date = page.getByLabel('Choose a date')
    const today = await date.inputValue()
    const box = await center(page, 'Week')
    const first = () =>
      week
        .getByRole('button')
        .first()
        .evaluate((button) => button.textContent)
    const thisWeek = await first()

    // when
    await drag(page, [box.x + box.width / 3, box.y], [box.x - box.width / 3, box.y])

    // then
    await expect.poll(first).not.toBe(thisWeek)
    await expect(date).toHaveValue(today) // the day that is selected is the same

    // when
    await drag(page, [box.x - box.width / 3, box.y], [box.x + box.width / 3, box.y])

    // then
    await expect.poll(first).toBe(thisWeek)
    await expect(date).toHaveValue(today)
  })

  test('has the round button on the right, on the line under the week', async ({ page }) => {
    // given
    await page.goto('/?seed=realistic')
    const week = page.getByRole('group', { name: 'Week' })
    await expect(week).toBeVisible()

    // when
    const toggle = page.getByRole('button', { name: 'Show the month' })

    // then: it is on the right, on the line that ends the week
    const line = await week.boundingBox()
    const circle = await toggle.boundingBox()
    if (!line || !circle) throw new Error('No week, or no button')
    expect(circle.x + circle.width / 2).toBeGreaterThan(line.x + line.width / 2)
    expect(Math.abs(circle.y + circle.height / 2 - (line.y + line.height))).toBeLessThan(14)
  })
})
