import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures.ts'
import { ensureCalendar } from '../calendars.ts'
import { chooseCalendar } from '../support/app.ts'

async function reload(page: Page) {
  await page.reload()
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
}

// These tests talk to the real local Radicale server (started by playwright.config.ts).

test.beforeAll(async ({ request }) => {
  await ensureCalendar(request, 'calendar', 'Calendar')
  await ensureCalendar(request, 'work', 'Work')
})

/** A title that is unique to this run and needs escaping in the iCalendar format. */
const uniqueTitle = (project: string) => `E2E ${project} ${Date.now()}: a, b; c\\d`

async function createEvent(page: Page, title: string) {
  await page.getByRole('button', { name: 'New event' }).click()
  await page.getByLabel('Title').fill(title)
  await chooseCalendar(page)
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText(title)).toBeVisible()
}

test.describe('english browser', () => {
  test.use({ locale: 'en-US' })

  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
  })

  test('creates an event and lists it', async ({ page }, { project }) => {
    const title = uniqueTitle(project.name)

    await createEvent(page, title)

    // It was stored on the server, not only in the page.
    await reload(page)
    await expect(page.getByText(title)).toBeVisible()
  })

  test('edits an event, keeping its values', async ({ page }, { project }) => {
    const title = uniqueTitle(project.name)
    await createEvent(page, title)

    await page.getByRole('button', { name: title }).click()
    await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
    await expect(page.getByRole('heading', { name: 'Edit event' })).toBeVisible()
    await expect(page.getByLabel('Title')).toHaveValue(title)
    await page.getByLabel('Title').fill(`${title} edited`)
    await page.getByLabel('Description').fill('Bring the forms')
    await page.getByRole('button', { name: 'Save' }).click()
    await page.getByRole('button', { name: /^(Back|Close)$/ }).click() // a saved event shows itself first

    await expect(page.getByText(`${title} edited`)).toBeVisible()
    await expect(page.getByText(title, { exact: true })).toBeHidden()

    await reload(page)
    await page.getByRole('button', { name: `${title} edited` }).click()
    await expect(page.getByText('Bring the forms')).toBeVisible() // the screen of the event
    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByLabel('Description')).toHaveValue('Bring the forms')
  })

  test('infers the kind of event and stores times on the server', async ({ page }, { project }) => {
    const title = uniqueTitle(project.name)
    await page.getByRole('button', { name: 'New event' }).click()
    await page.getByLabel('Title').fill(title)
    await chooseCalendar(page)
    const today = await page.getByLabel('Start date').inputValue() // a new event starts today
    await page.getByLabel('Start time').fill('09:30')
    await page.getByLabel('End time').fill('10:45')
    await page.getByRole('button', { name: 'Save' }).click()

    const card = page.getByRole('button', { name: title })
    await expect(card).toContainText('09:30')
    await expect(card).toContainText('10:45')

    await reload(page)
    await card.click()
    await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
    await expect(page.getByLabel('Start date')).toHaveValue(today)
    await expect(page.getByLabel('Start time')).toHaveValue('09:30')
    await expect(page.getByLabel('End date')).toHaveValue(today)
    await expect(page.getByLabel('End time')).toHaveValue('10:45')
  })

  test('writes to the chosen calendar and moves an event between calendars', async ({ page }, {
    project,
  }) => {
    const title = uniqueTitle(project.name)
    await page.getByRole('button', { name: 'New event' }).click()
    await page.getByLabel('Title').fill(title)
    await chooseCalendar(page)
    await page.getByRole('combobox', { name: 'Calendar' }).click()
    await page.getByRole('option', { name: 'Work' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText(title)).toBeVisible()

    await reload(page)
    await page.getByRole('button', { name: title }).click()
    await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
    await expect(page.getByRole('combobox', { name: 'Calendar' })).toContainText('Work')

    await page.getByRole('combobox', { name: 'Calendar' }).click()
    await page.getByRole('option', { name: 'Calendar' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.getByRole('button', { name: /^(Back|Close)$/ }).click() // a saved event shows itself first
    await expect(page.getByText(title)).toBeVisible()

    await reload(page)
    await page.getByRole('button', { name: title }).click()
    await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
    await expect(page.getByRole('combobox', { name: 'Calendar' })).toContainText('Calendar')
  })
})
