import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

test.use({ locale: 'en-US' })

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations).toEqual([])
}

test('the event list has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()

  await expectNoViolations(page)
})

test('the new event screen has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New event' }).click()
  await expect(page.getByRole('heading', { name: 'New event' })).toBeVisible()

  await expectNoViolations(page)
})

test('the edit event screen has no detectable accessibility violations', async ({ page }, {
  project,
}) => {
  // Create the event to edit, so the test does not depend on what the server already holds.
  const title = `A11y ${project.name} ${Date.now()}`
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible() // the calendars are loaded
  await page.getByRole('button', { name: 'New event' }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: `Edit ${title}` }).click()
  await expect(page.getByRole('heading', { name: 'Edit event' })).toBeVisible()

  await expectNoViolations(page)
})

test('the settings screen has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  await expectNoViolations(page)
})

test('the dark theme has no detectable accessibility violations', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()

  await expectNoViolations(page)
})
