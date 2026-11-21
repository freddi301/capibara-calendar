import { expect, test } from '../support/seeded.ts'

test.describe('calendar edit, mobile portrait', () => {
  test.use({ viewport: { width: 412, height: 915 } })

  test('has the name and the color as high as a text', async ({ page }) => {
    // given
    await page.goto('/?seed=realistic')
    await page.getByRole('button', { name: 'Calendars' }).click()

    // when
    await page.getByRole('button', { name: 'New calendar' }).click()

    // then
    const height = async (locator: ReturnType<typeof page.getByLabel>) =>
      Math.round((await locator.boundingBox())?.height ?? 0)
    const text = await height(page.getByLabel('Name'))
    expect(text).toBeGreaterThan(0)
    expect(await height(page.getByRole('button', { name: 'Calendar color' }))).toBe(text)
  })
})
