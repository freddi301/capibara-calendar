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
  await page.getByRole('button', { name: title }).click()
  await expect(page.getByRole('heading', { name: 'Edit event' })).toBeVisible()

  await expectNoViolations(page)
})

test('the settings screen has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  await expectNoViolations(page)
})

test('the month layout has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
  await page.getByRole('button', { name: 'Layouts' }).click()
  await page.getByRole('button', { name: 'Month', exact: true }).click()
  await expect(page.getByRole('group', { name: 'Month' })).toBeVisible()

  await expectNoViolations(page)
})

test('the week rows layout has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
  await page.getByRole('button', { name: 'Layouts' }).click()
  await page.getByRole('button', { name: 'Week rows' }).click()
  await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()

  await expectNoViolations(page)
})

test('the agenda has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
  await page.getByRole('button', { name: 'Layouts' }).click()
  await page.getByRole('button', { name: 'Agenda' }).click()
  await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()

  await expectNoViolations(page)
})

test('the layouts screen has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Layouts' }).click()
  await expect(page.getByRole('heading', { name: 'Layouts' })).toBeVisible()

  await expectNoViolations(page)
})

test('the dark theme has no detectable accessibility violations', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()

  await expectNoViolations(page)
})
