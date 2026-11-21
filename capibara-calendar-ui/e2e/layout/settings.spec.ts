import { expect, test } from '../support/seeded.ts'

test.describe('settings, mobile portrait', () => {
  test.use({ viewport: { width: 412, height: 915 } })

  test('has the options of the lists at least as big as the recommended touch target', async ({
    page,
  }) => {
    // given
    await page.goto('/?seed=realistic')
    await page.getByRole('button', { name: 'Settings' }).click()

    for (const name of ['Language', 'Theme']) {
      // when
      await page.getByRole('combobox', { name }).click()
      await expect(page.getByRole('option').first()).toBeVisible() // the list has finished opening

      // then
      for (const option of await page.getByRole('option').all()) {
        expect((await option.boundingBox())?.height).toBeGreaterThanOrEqual(44)
      }
      await page.keyboard.press('Escape')
      await expect(page.getByRole('option')).toHaveCount(0) // and closing
    }
  })

  test('has the selects as high as a text input', async ({ page }) => {
    // given
    await page.goto('/?seed=realistic')

    // when
    await page.getByRole('button', { name: 'Settings' }).click()

    // then
    const height = async (locator: ReturnType<typeof page.getByLabel>) =>
      Math.round((await locator.boundingBox())?.height ?? 0)
    const text = await height(page.getByLabel('Server address'))
    expect(text).toBeGreaterThan(0)
    for (const name of ['Language', 'Theme', 'Time zone', 'First day of the week']) {
      expect(await height(page.getByRole('combobox', { name })), name).toBe(text)
    }
  })
})
