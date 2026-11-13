import { expect, test } from '@playwright/test'
import { ensureCalendar, findEvent, removeFound } from './calendars.ts'

// These tests talk to the real local Radicale server (started by playwright.config.ts).

test.use({ locale: 'en-US' })

test.beforeAll(async ({ request }) => {
  await ensureCalendar(request, 'calendar', 'Calendar')
})

test('the time zone of an event is searched in the list of all of them, and is remembered', async ({
  page,
  request,
}, { project }) => {
  const title = `Zone ${project.name} ${Date.now()}`
  try {
    await page.goto('/')
    await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
    const appZone = await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone)

    await page.getByRole('button', { name: 'New event' }).click()
    await page.getByLabel('Title').fill(title)
    await page.getByRole('combobox', { name: 'Calendar' }).click()
    await page.getByRole('option', { name: 'Calendar', exact: true }).click()
    await page.getByLabel('Start time').fill('09:30')
    await page.getByLabel('End time').fill('10:30')
    await page.getByRole('button', { name: 'Time zone' }).click()
    await page.getByRole('combobox', { name: 'Time zone', exact: true }).click()

    // First the zone of the app, then UTC with what it means, then floating, and then all the others.
    const options = page.getByRole('option')
    await expect(options.nth(0)).toContainText(appZone)
    await expect(options.nth(1)).toContainText('UTC')
    await expect(options.nth(1)).toContainText('Universal time')
    await expect(options.nth(2)).toContainText('Floating')

    await page.getByLabel('Search a time zone').fill('reykjavik')
    await expect(options).toHaveCount(1)
    await options.first().click()
    await expect(page.getByRole('combobox', { name: 'Time zone', exact: true })).toContainText(
      'Atlantic/Reykjavik',
    )
    // The time that it is for the person is under the start and the end, with the name of its zone.
    await expect(page.getByText(new RegExp(`^\\d{2}:\\d{2} ${appZone}$`))).toBeVisible()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: title })).toBeVisible() // back on the list

    await expect
      .poll(async () => (await findEvent(request, 'calendar', title))?.ics)
      .toContain('DTSTART;TZID=Atlantic/Reykjavik:')

    await page.reload()
    await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
    await page.getByRole('button', { name: title }).click()
    await page.getByRole('button', { name: 'Edit' }).click()
    await expect(page.getByRole('combobox', { name: 'Time zone', exact: true })).toContainText(
      'Atlantic/Reykjavik',
    )
  } finally {
    await removeFound(request, 'calendar', title)
  }
})
