import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'

test.use({ locale: 'en-US' })

test('the main page has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()

  const { violations } = await new AxeBuilder({ page }).analyze()

  expect(violations).toEqual([])
})
