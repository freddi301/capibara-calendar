import { expect, test } from '@playwright/test'
import { ensureCalendar, icsDay, putEvent, removeEvent } from '../calendars.ts'
import { reload, unique, uid, open } from '../support/app.ts'

// These tests talk to the real local Radicale server (started by playwright.config.ts).

test.use({ locale: 'en-US' })

test.beforeAll(async ({ request }) => {
  await ensureCalendar(request, 'calendar', 'Calendar')
  await ensureCalendar(request, 'work', 'Work')
})

test.describe('what to view', () => {
  test('shows the tags, the place and the description in the items, when they are chosen', async ({
    page,
    request,
  }, { project }) => {
    const title = unique(project.name, 'Details')
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [
        `DTSTART;VALUE=DATE:${icsDay(0)}`,
        'LOCATION:Room 4',
        'CATEGORIES:Work,team',
        'DESCRIPTION:Bring the forms',
      ],
    })
    try {
      await open(page)
      const item = page.getByRole('button', { name: new RegExp(title) })
      await expect(item).toBeVisible()
      await expect(item).toContainText('Room 4')
      await expect(item).toContainText('Work')
      await expect(item).toContainText('Bring the forms')

      await page.getByRole('button', { name: 'What to view' }).click()
      await expect(page.getByRole('heading', { name: 'What to view' })).toBeVisible()
      await page.getByRole('checkbox', { name: 'Place' }).click()
      await page.getByRole('checkbox', { name: 'Description' }).click()
      await page.getByRole('button', { name: /^(Back|Close)$/ }).click()

      await expect(item).not.toContainText('Room 4')
      await expect(item).not.toContainText('Bring the forms')
      await expect(item).toContainText('Work') // still chosen

      await page.reload() // remembered
      await expect(item).not.toContainText('Room 4')
      await expect(item).toContainText('Work')
    } finally {
      await removeEvent(request, 'calendar', uid(title))
    }
  })
})

test.describe('the filter', () => {
  test('hides the events of a calendar, remembers it, and shows them again', async ({
    page,
    request,
  }, { project }) => {
    const mine = unique(project.name, 'Mine')
    const work = unique(project.name, 'Office')
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(mine),
      title: mine,
      lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`],
    })
    await putEvent(request, {
      slug: 'work',
      uid: uid(work),
      title: work,
      lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`],
    })
    try {
      await open(page)
      await expect(page.getByRole('button', { name: mine })).toBeVisible()
      await expect(page.getByRole('button', { name: work })).toBeVisible()

      await page.getByRole('button', { name: 'Calendars' }).click()
      await expect(page.getByRole('switch', { name: 'Work' })).toBeChecked() // all are shown
      await page.getByRole('switch', { name: 'Work' }).click()
      await expect(page.getByRole('switch', { name: 'Work' })).not.toBeChecked()
      await page.getByRole('button', { name: /^(Back|Close)$/ }).click()

      await expect(page.getByRole('button', { name: mine })).toBeVisible()
      await expect(page.getByRole('button', { name: work })).toHaveCount(0)

      // Remembered by the browser.
      await reload(page)
      await expect(page.getByRole('button', { name: mine })).toBeVisible()
      await expect(page.getByRole('button', { name: work })).toHaveCount(0)

      await page.getByRole('button', { name: 'Calendars' }).click()
      await page.getByRole('button', { name: 'Hide all' }).click()
      await expect(page.getByRole('switch', { name: 'Calendar' })).not.toBeChecked()
      await page.getByRole('button', { name: /^(Back|Close)$/ }).click()
      await expect(page.getByRole('button', { name: mine })).toHaveCount(0)

      await page.getByRole('button', { name: 'Calendars' }).click()
      await page.getByRole('button', { name: 'Show all' }).click()
      await expect(page.getByRole('switch', { name: 'Work' })).toBeChecked()
      await page.getByRole('button', { name: /^(Back|Close)$/ }).click()
      await expect(page.getByRole('button', { name: mine })).toBeVisible()
      await expect(page.getByRole('button', { name: work })).toBeVisible()
    } finally {
      await removeEvent(request, 'calendar', uid(mine))
      await removeEvent(request, 'work', uid(work))
    }
  })
})
