import { expect, test, type Locator, type Page } from '@playwright/test'
import { ensureCalendar, icsDay, putEvent, removeEvent } from '../calendars.ts'
import { reload, unique, uid, open, chooseCalendar } from '../support/app.ts'

// These tests talk to the real local Radicale server (started by playwright.config.ts).

test.use({ locale: 'en-US' })

test.beforeAll(async ({ request }) => {
  await ensureCalendar(request, 'calendar', 'Calendar')
  await ensureCalendar(request, 'work', 'Work')
})

test.describe('the form of an event', () => {
  const failPuts = async (page: Page, action: 'abort' | 'fail') => {
    await page.route(/\/radicale\//, async (route) => {
      if (route.request().method() !== 'PUT') return route.continue()
      return action === 'abort' ? route.abort() : route.fulfill({ status: 500 })
    })
  }

  test('says what went wrong when the server fails, keeps what was typed, and saves when it works again', async ({
    page,
  }, { project }) => {
    const title = unique(project.name, 'Retry')
    await open(page)
    await page.getByRole('button', { name: 'New event' }).click()
    await page.getByLabel('Title').fill(title)
    await chooseCalendar(page)

    await failPuts(page, 'abort')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('alert')).toHaveText(/Cannot reach the CalDAV server/)
    await expect(page.getByLabel('Title')).toHaveValue(title)

    await page.unroute(/\/radicale\//)
    await failPuts(page, 'fail')
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('alert')).toHaveText(/The event could not be saved\./)
    await expect(page.getByLabel('Title')).toHaveValue(title)

    await page.unroute(/\/radicale\//)
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('button', { name: title })).toBeVisible() // saved, and back to the list
  })

  test('says when the event was changed on the server after it was opened', async ({
    page,
    request,
  }, { project }) => {
    const title = unique(project.name, 'Conflict')
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`],
    })
    try {
      await open(page)
      await page.getByRole('button', { name: title }).click()
      await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
      await expect(page.getByRole('heading', { name: 'Edit event' })).toBeVisible()
      // Someone else changes it.
      await putEvent(request, {
        slug: 'calendar',
        uid: uid(title),
        title: `${title} changed`,
        lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`],
      })

      await page.getByLabel('Title').fill(`${title} mine`)
      await page.getByRole('button', { name: 'Save' }).click()

      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toContainText('This event was changed somewhere else')
      await dialog.getByRole('button', { name: 'Save anyway' }).click()
      await page.getByRole('button', { name: /^(Back|Close)$/ }).click() // a saved event shows itself first

      // Written over the change of the other, from the event as it is on the server.
      await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
      await expect(page.getByRole('button', { name: `${title} mine` })).toBeVisible()
      await expect(page.getByRole('button', { name: `${title} changed` })).toHaveCount(0)
    } finally {
      await removeEvent(request, 'calendar', uid(title))
    }
  })

  test('keeps the location, the link, the tags and the reminder, on the server', async ({ page }, {
    project,
  }) => {
    const title = unique(project.name, 'Details')
    await open(page)
    await page.getByRole('button', { name: 'New event' }).click()
    await page.getByLabel('Title').fill(title)
    await chooseCalendar(page)
    await page.getByLabel('Location').fill('Room 4')
    await page.getByLabel('Video call link').fill('https://meet.example.org/details')
    await page.getByLabel('New tag').fill('Work')
    await page.getByRole('button', { name: 'Add tag' }).click()
    await page.getByLabel('New tag').fill('team')
    await page.getByLabel('New tag').press('Enter')
    await page.getByRole('button', { name: 'Add alert' }).click()
    await page.getByRole('combobox', { name: 'Alert 1' }).click()
    await page.getByRole('option', { name: '15 minutes before' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: title })).toBeVisible()

    try {
      await reload(page)
      await page.getByRole('button', { name: title }).click()

      // It is only looked at, at first: in text, not in fields.
      await expect(page.getByText('Room 4')).toBeVisible()
      await expect(page.getByLabel('Location')).toHaveCount(0)
      await page.getByRole('button', { name: 'Edit' }).click()

      await expect(page.getByLabel('Location')).toHaveValue('Room 4')
      await expect(page.getByLabel('Video call link')).toHaveValue(
        'https://meet.example.org/details',
      )
      await expect(page.getByRole('group', { name: 'Tags' })).toContainText('Work')
      await expect(page.getByRole('group', { name: 'Tags' })).toContainText('team')
      await expect(page.getByRole('combobox', { name: 'Alert 1' })).toContainText(
        '15 minutes before',
      )
    } finally {
      await page.getByRole('button', { name: 'Delete' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    }
  })

  test('keeps the tags in the order that they were moved to, on the server', async ({ page }, {
    project,
  }) => {
    const title = unique(project.name, 'Tags order')
    await open(page)
    await page.getByRole('button', { name: 'New event' }).click()
    await page.getByLabel('Title').fill(title)
    await chooseCalendar(page)
    await page.getByLabel('New tag').fill('Work, team, trip')
    await page.getByLabel('New tag').press('Enter')
    const tags = page.getByRole('group', { name: 'Tags' })
    await expect(tags).toHaveText(/Work\s*team\s*trip/)

    // when
    await tags.getByRole('button', { name: 'Move Work', exact: true }).focus()
    const said = page.locator('[aria-live]')
    await page.keyboard.press('Space')
    await expect(said.first()).toHaveText('Work is at position 1')
    await page.keyboard.press('ArrowRight')
    await expect(said.first()).toHaveText('Work is at position 2')
    await page.keyboard.press('ArrowRight')
    await expect(said.first()).toHaveText('Work is at position 3')
    await page.keyboard.press('Space')

    // then
    await expect(tags).toHaveText(/team\s*trip\s*Work/)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: title })).toBeVisible()

    try {
      await reload(page)
      await page.getByRole('button', { name: title }).click()
      await page.getByRole('button', { name: 'Edit' }).click()
      await expect(page.getByRole('group', { name: 'Tags' })).toHaveText(/team\s*trip\s*Work/)
    } finally {
      await page.getByRole('button', { name: 'Delete' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    }
  })

  test('deletes an event only when it is confirmed', async ({ page, request }, { project }) => {
    const title = unique(project.name, 'Delete')
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`],
    })
    try {
      await open(page)
      await page.getByRole('button', { name: title }).click()
      await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
      await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()

      await page.getByRole('button', { name: 'Delete' }).click()
      await expect(page.getByText('Delete this event?')).toBeVisible()
      await page.getByRole('button', { name: 'Cancel' }).click()
      await expect(page.getByText('Delete this event?')).toHaveCount(0)
      await expect(page.getByRole('heading', { name: 'Edit event' })).toBeVisible()

      await page.getByRole('button', { name: 'Delete' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
      await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
      await expect(page.getByRole('button', { name: title })).toHaveCount(0)

      // Gone from the server, not only from the page.
      await reload(page)
      await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
      await expect(page.getByRole('button', { name: title })).toHaveCount(0)
    } finally {
      await removeEvent(request, 'calendar', uid(title))
    }
  })

  test('has no delete button for an event that is new', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'New event' }).click()
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Delete' })).toHaveCount(0)
  })
})

test.describe('what is not lost by chance', () => {
  test('asks before the form is left with changes, and lets the person keep them', async ({
    page,
  }, { project }) => {
    await open(page)
    await page.getByRole('button', { name: 'New event' }).click()
    const title = unique(project.name, 'Draft')
    await page.getByLabel('Title').fill(title)
    await chooseCalendar(page)

    await page.getByRole('button', { name: /^(Back|Close)$/ }).click()
    await expect(page.getByText('Discard your changes?')).toBeVisible()
    await page.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page.getByLabel('Title')).toHaveValue(title) // still there

    await page.getByRole('button', { name: /^(Back|Close)$/ }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Discard' }).click()
    await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
    await expect(page.getByText(title)).toHaveCount(0) // not saved
  })

  test('does not ask when nothing was changed', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'New event' }).click()
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()

    await page.getByRole('button', { name: /^(Back|Close)$/ }).click()

    await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
    await expect(page.getByText('Discard your changes?')).toHaveCount(0)
  })
})

test.describe('the height of the fields', () => {
  const height = async (locator: Locator) => Math.round((await locator.boundingBox())?.height ?? 0)

  test('is the same for the selects, the dates, the times and the numbers of an event as for a text', async ({
    page,
  }) => {
    await open(page)
    await page.getByRole('button', { name: 'New event' }).click()
    await page.getByRole('combobox', { name: 'Repeat', exact: true }).click()
    await page.getByRole('option', { name: 'Week', exact: true }).click()
    await page.getByRole('combobox', { name: 'How the repeat ends' }).click()
    await page.getByRole('option', { name: 'Ends on' }).click()

    // The fields that show a date or a time are the read-only ones that are above the real ones.
    const shown = (label: string) => page.getByLabel(label).locator('xpath=ancestor::label')
    const text = await height(page.getByLabel('Repeat every')) // a plain input, with a number
    expect(text).toBeGreaterThan(0)
    for (const field of [
      page.getByRole('combobox', { name: 'Calendar' }),
      page.getByRole('combobox', { name: 'Repeat', exact: true }),
      page.getByRole('combobox', { name: 'How the repeat ends' }),
      shown('Start date'),
      shown('Start time'),
      shown('End date'),
      shown('End time'),
      shown('Repeat until'),
    ]) {
      expect(await height(field)).toBe(text)
    }
  })

  test('is the same for the name and the color of a calendar', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Calendars' }).click()
    await page.getByRole('button', { name: 'New calendar' }).click()

    const text = await height(page.getByLabel('Name'))
    expect(text).toBeGreaterThan(0)
    expect(await height(page.getByRole('button', { name: 'Calendar color' }))).toBe(text)
  })
})
