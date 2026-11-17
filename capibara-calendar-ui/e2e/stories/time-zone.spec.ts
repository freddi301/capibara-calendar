import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures.ts'
import { ensureCalendar, findEvent, removeFound } from '../calendars.ts'

// These tests talk to the real local Radicale server (started by playwright.config.ts).

test.use({ locale: 'en-US' })

test.beforeAll(async ({ request }) => {
  await ensureCalendar(request, 'calendar', 'Calendar')
})

const startZone = (page: Page) => page.getByRole('combobox', { name: 'Time zone of the start' })
const endZone = (page: Page) => page.getByRole('combobox', { name: 'Time zone of the end' })

async function openNewEvent(page: Page, title: string) {
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
  await page.getByRole('button', { name: 'New event' }).click()
  await page.getByLabel('Title').fill(title)
  await page.getByRole('combobox', { name: 'Calendar' }).click()
  await page.getByRole('option', { name: 'Calendar', exact: true }).click()
}

async function chooseZone(page: Page, select: 'Start' | 'End', search: string) {
  await page.getByRole('combobox', { name: `Time zone of the ${select.toLowerCase()}` }).click()
  await page.getByLabel('Search a time zone').fill(search)
  await page.getByRole('option').first().click()
}

test('the time zone of an event is searched in the list of all of them, and is remembered', async ({
  page,
  request,
}, { project }) => {
  const title = `Zone ${project.name} ${Date.now()}`
  try {
    await openNewEvent(page, title)
    const appZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)
    const appCity = appZone.split('/').pop()?.replaceAll('_', ' ') ?? appZone
    await page.getByLabel('Start time').fill('09:30')
    await page.getByLabel('End time').fill('10:30')
    await startZone(page).click()

    // First the zone of the app, then UTC with what it means, then floating, and then all the others.
    const options = page.getByRole('option')
    await expect(options.nth(0)).toContainText(appCity)
    await expect(options.nth(1)).toContainText('UTC')
    await expect(options.nth(1)).toContainText('Universal time')
    await expect(options.nth(2)).toContainText('Floating')

    await page.getByLabel('Search a time zone').fill('reykjavik')
    await expect(options).toHaveCount(1)
    await options.first().click()
    await expect(startZone(page)).toContainText('Reykjavik')
    await expect(endZone(page)).toContainText('Reykjavik') // the end follows the start
    // The time that it is for the person is under the start and under the end, with the name of its zone.
    await expect(page.getByText(new RegExp(`^\\d{2}:\\d{2} ${appCity}$`))).toHaveCount(2)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: title })).toBeVisible() // back on the list

    await expect
      .poll(async () => (await findEvent(request, 'calendar', title))?.ics)
      .toContain('DTSTART;TZID=Atlantic/Reykjavik:')

    await page.reload()
    await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
    await page.getByRole('button', { name: title }).click()
    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(startZone(page)).toContainText('Reykjavik')
  } finally {
    await removeFound(request, 'calendar', title)
  }
})

test('a flight that starts in one zone and ends in another keeps both zones on the server', async ({
  page,
  request,
}, { project }) => {
  const title = `Flight ${project.name} ${Date.now()}`
  try {
    await openNewEvent(page, title)
    await page.getByLabel('Start time').fill('15:00')
    await page.getByLabel('End time').fill('15:30')
    await startZone(page).click()
    await page.getByRole('option', { name: /^UTC/ }).click()
    await chooseZone(page, 'End', 'new york')
    await expect(endZone(page)).toContainText('New York')
    await expect(page.getByText('5 h 30 min')).toBeVisible() // 15:00 in UTC to 15:30 in New York
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: title })).toBeVisible() // back on the list

    await expect
      .poll(async () => (await findEvent(request, 'calendar', title))?.ics)
      .toContain('DTEND;TZID=America/New_York:')

    await page.reload()
    await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
    await page.getByRole('button', { name: title }).click()
    await expect(page.getByText('UTC', { exact: true })).toBeVisible()
    await expect(page.getByText('New York', { exact: true })).toBeVisible()

    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(startZone(page)).toContainText('UTC')
    await expect(endZone(page)).toContainText('New York')
    await expect(page.getByLabel('Start time')).toHaveValue('15:00')
    await expect(page.getByLabel('End time')).toHaveValue('15:30')
  } finally {
    await removeFound(request, 'calendar', title)
  }
})
