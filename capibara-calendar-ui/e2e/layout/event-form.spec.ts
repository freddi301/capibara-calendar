import type { Locator } from '@playwright/test'
import { expect, test } from '../support/seeded.ts'

const height = async (locator: Locator) => Math.round((await locator.boundingBox())?.height ?? 0)

test.describe('event form, mobile portrait', () => {
  test.use({ viewport: { width: 412, height: 915 } })

  test('grows the title box for a long title and keeps it on one line', async ({ page }) => {
    // given
    await page.goto('/?seed=realistic')
    await page.getByRole('button', { name: 'New event' }).click()
    const title = page.getByLabel('Title')
    const oneRow = await height(title)

    // when
    await title.fill('A very long title '.repeat(40))

    // then
    expect(await height(title)).toBeGreaterThan(oneRow * 2)

    // when
    await title.fill('Lunch')
    await title.press('Enter')
    await title.pressSequentially('with Sam')

    // then
    await expect(title).toHaveValue('Lunchwith Sam')
    expect(await height(title)).toBe(oneRow)
  })

  test('has the selects, the dates, the times and the numbers as high as a text', async ({
    page,
  }) => {
    // given
    await page.goto('/?seed=realistic')
    await page.getByRole('button', { name: 'New event' }).click()
    await page.getByRole('combobox', { name: 'Repeat', exact: true }).click()
    await page.getByRole('option', { name: 'Week', exact: true }).click()
    await page.getByRole('combobox', { name: 'How the repeat ends' }).click()
    await page.getByRole('option', { name: 'Ends on' }).click()

    // when: the fields that show a date or a time are the read-only ones above the real ones
    const shown = (label: string) => page.getByLabel(label).locator('xpath=ancestor::label')
    const text = await height(page.getByLabel('Repeat every')) // a plain input, with a number

    // then
    expect(text).toBeGreaterThan(0)
    for (const field of [
      page.getByRole('combobox', { name: 'Calendar' }),
      page.getByRole('combobox', { name: 'Repeat', exact: true }),
      page.getByRole('combobox', { name: 'How the repeat ends' }),
      shown('Start date'),
      shown('Start time'),
      shown('End date'),
      shown('End time'),
      shown('Repeat until'),
    ]) {
      expect(await height(field)).toBe(text)
    }
  })
})
