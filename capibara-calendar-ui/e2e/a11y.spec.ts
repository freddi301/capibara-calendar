import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'
import { chooseCalendar } from './support/app.ts'

test.use({ locale: 'en-US' })

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations).toEqual([])
}

// For after a change of colors: the colors are animated, and are not the final ones at once.
async function expectNoViolationsOnceSettled(page: Page) {
  await expect
    .poll(async () => (await new AxeBuilder({ page }).analyze()).violations.map(({ id }) => id))
    .toEqual([])
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
  await chooseCalendar(page)
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: title }).click()
  await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
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
  await page.getByRole('button', { name: 'Show the month' }).click()
  await expect(page.getByRole('group', { name: 'Month' })).toBeVisible()

  await expectNoViolations(page)
})

test('the week rows layout has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
  await page.getByRole('button', { name: 'Layouts' }).click()
  await page.getByRole('button', { name: 'Week', exact: true }).click()
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

test('the repeat rows of the event have no detectable accessibility violations', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New event' }).click()
  await page.getByRole('combobox', { name: 'Repeat', exact: true }).click()
  await page.getByRole('option', { name: 'Week', exact: true }).click()
  await page.getByRole('combobox', { name: 'How the repeat ends' }).click()
  await page.getByRole('option', { name: 'Ends after' }).click()
  await expect(page.getByLabel('Repeat this many times')).toBeVisible()

  await expectNoViolations(page)
})

test('the layouts screen has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Layouts' }).click()
  await expect(page.getByRole('heading', { name: 'Layouts' })).toBeVisible()

  await expectNoViolations(page)
})

test('the calendars screen has no detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Calendars' }).click()
  await expect(page.getByRole('switch').first()).toBeVisible()

  await expectNoViolations(page)
})

test('the filter screen, with rules, has no detectable accessibility violations', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Filter' }).click()
  await page.getByRole('button', { name: 'Add rule' }).click()
  await page.getByRole('menuitem', { name: /Title/ }).click()
  await page.getByRole('textbox', { name: 'Title' }).fill('dentist')
  await page.getByRole('button', { name: 'Add rule' }).click()
  await page.getByRole('menuitem', { name: /People/ }).click()
  await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible()

  await expectNoViolations(page)
})

test('the filter screen has no detectable accessibility violations in the dark theme', async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await page.getByRole('button', { name: 'Filter' }).click()
  await page.getByRole('button', { name: 'Add rule' }).click()
  await page.getByRole('menuitem', { name: /Status/ }).click()

  await expectNoViolationsOnceSettled(page)
})

test('the question about deleting an event has no detectable accessibility violations', async ({
  page,
}, { project }) => {
  const title = `A11y delete ${project.name} ${Date.now()}`
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
  await page.getByRole('button', { name: 'New event' }).click()
  await page.getByLabel('Title').fill(title)
  await chooseCalendar(page)
  await page.getByRole('button', { name: 'Save' }).click()
  await page.getByRole('button', { name: title }).click()
  await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()

  await expectNoViolations(page)
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveClass(/dark/)
  await expectNoViolationsOnceSettled(page)
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click() // clean up
})

test('the problems of the form have no detectable accessibility violations', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
  await page.getByRole('button', { name: 'New event' }).click()
  await page.getByLabel('Title').fill('A11y problem')
  await chooseCalendar(page)
  await page.route(/\/radicale\//, (route) =>
    route.request().method() === 'PUT' ? route.fulfill({ status: 500 }) : route.continue(),
  )
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('alert')).toBeVisible()

  await expectNoViolations(page)
})

test('the dark theme has no detectable accessibility violations', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()

  await expectNoViolations(page)

  await page.getByRole('button', { name: 'Calendars' }).click()
  await expect(page.getByRole('switch').first()).toBeVisible()
  await expectNoViolationsOnceSettled(page)
})
