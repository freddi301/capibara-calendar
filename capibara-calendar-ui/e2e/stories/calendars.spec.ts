import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures.ts'
import { ensureCalendar, icsDay, putEvent, removeEvent, setCalendarColor } from '../calendars.ts'
import { unique, uid, open } from '../support/app.ts'

// These tests talk to the real local Radicale server (started by playwright.config.ts).

test.use({ locale: 'en-US' })

test.beforeAll(async ({ request }) => {
  await ensureCalendar(request, 'calendar', 'Calendar')
  await ensureCalendar(request, 'work', 'Work')
})

test.describe('the colors of the calendars', () => {
  const edge = (scope: ReturnType<Page['locator']>) =>
    scope.locator('[data-slot="calendar-color"]').first()

  test('are the ones of the server, on the events, in the list of the calendars and in the form', async ({
    page,
    request,
  }, { project }) => {
    // A calendar for this test: the others are used by tests that run at the same time.
    const slug = `colors-${project.name}`
    const name = `Colors ${project.name}`
    await ensureCalendar(request, slug, name)
    const title = unique(project.name, 'Colored')
    await setCalendarColor(request, slug, '#FF0000FF') // as other apps write it, with the transparency
    await putEvent(request, {
      slug,
      uid: uid(title),
      title,
      lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`],
    })
    try {
      await open(page)

      // The border on the left of the event is 4 pixels wide, and the color of its calendar.
      const item = edge(page.getByRole('button', { name: title }))
      await expect(item).toBeVisible()
      await expect(item).toHaveCSS('border-right-color', 'rgb(255, 0, 0)')
      await expect(item).toHaveCSS('border-right-width', '4px')

      await page.getByRole('button', { name: 'Calendars' }).click()
      await expect(page.locator('[data-slot="calendar-color"]', { hasText: name })).toHaveCSS(
        'border-right-color',
        'rgb(255, 0, 0)',
      )
      await page.getByRole('button', { name: /^(Back|Close)$/ }).click()

      await page.getByRole('button', { name: 'New event' }).click()
      const select = page.getByRole('combobox', { name: 'Calendar' })
      await select.click()
      const option = page.getByRole('option', { name })
      await expect(option).toHaveCSS('border-right-color', 'rgb(255, 0, 0)')
      await option.click()
      await expect(select).toHaveCSS('border-right-color', 'rgb(255, 0, 0)')
      await expect(select).toHaveCSS('border-right-width', '4px')
    } finally {
      await removeEvent(request, slug, uid(title))
      await setCalendarColor(request, slug, undefined)
    }
  })
})

test.describe('the refresh button', () => {
  test('brings what other apps put on the server, which the page would not ask for yet', async ({
    page,
    request,
  }, { project }) => {
    const title = unique(project.name, 'Later')
    await open(page)
    await expect(page.getByRole('button', { name: title })).toHaveCount(0)
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`],
    })
    try {
      await page.getByRole('button', { name: 'Refresh' }).click()

      await expect(page.getByRole('button', { name: title })).toBeVisible()
    } finally {
      await removeEvent(request, 'calendar', uid(title))
    }
  })
})

test.describe('the calendars', () => {
  test('are made, renamed, given a color and deleted, from the list of the calendars', async ({
    page,
  }, { project }) => {
    const name = unique(project.name, 'Made')
    await open(page)
    await page.getByRole('button', { name: 'Calendars' }).click()
    await page.getByRole('button', { name: 'New calendar' }).click()
    await expect(page.getByRole('heading', { name: 'New calendar' })).toBeVisible()

    await page.getByLabel('Name').fill(name)
    await page.getByRole('button', { name: 'Calendar color' }).click()
    await page.getByRole('button', { name: 'Violet' }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    const row = page.locator('[data-slot="calendar-color"]', { hasText: name })
    await expect(row).toBeVisible()
    await expect(row).toHaveCSS('border-right-color', 'rgb(124, 58, 237)')

    // Open it by pressing its name, and change the name and the color.
    await row.getByRole('button', { name }).click()
    await expect(page.getByRole('heading', { name: 'Edit calendar' })).toBeVisible()
    await page.getByLabel('Name').fill(`${name} renamed`)
    await page.getByRole('button', { name: 'Calendar color' }).click()
    await page.getByRole('button', { name: 'Teal' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    const renamed = page.locator('[data-slot="calendar-color"]', { hasText: `${name} renamed` })
    await expect(renamed).toBeVisible()
    await expect(renamed).toHaveCSS('border-right-color', 'rgb(15, 118, 110)')

    // Pressing the switch hides it, and does not open it.
    await renamed.getByRole('switch').click()
    await expect(page.getByRole('heading', { name: 'Calendars' })).toBeVisible()
    await expect(renamed.getByRole('switch')).not.toBeChecked()
    await renamed.getByRole('switch').click()

    // And it goes, with the question first.
    await renamed.getByRole('button', { name: `${name} renamed` }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(
      page.getByText('All its events are deleted with it. This cannot be undone.'),
    ).toBeVisible()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('heading', { name: 'Calendars' })).toBeVisible()
    await expect(page.getByText(`${name} renamed`)).toHaveCount(0)

    // Gone from the server too, not only from the page.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Calendars' })).toBeVisible()
    await expect(page.getByText(`${name} renamed`)).toHaveCount(0)
  })
})
