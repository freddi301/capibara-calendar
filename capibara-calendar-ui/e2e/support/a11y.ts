import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

export async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations).toEqual([])
}

export async function expectNoViolationsOnceSettled(page: Page) {
  await expect
    .poll(async () => (await new AxeBuilder({ page }).analyze()).violations.map(({ id }) => id))
    .toEqual([])
}

export async function openSeeded(page: Page, params = '') {
  await page.goto(`/?seed=realistic${params}`)
  await expect(page.getByRole('button', { name: /Design review/ })).toBeVisible()
}
