import { expect, test, type Page } from '@playwright/test'
import { ensureCalendar } from './calendars.ts'

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
    await page.reload()
    await expect(page.getByText(title)).toBeVisible()
  })

  test('edits an event, keeping its values', async ({ page }, { project }) => {
    const title = uniqueTitle(project.name)
    await createEvent(page, title)

    await page.getByRole('button', { name: `Edit ${title}` }).click()
    await expect(page.getByRole('heading', { name: 'Edit event' })).toBeVisible()
    await expect(page.getByLabel('Title')).toHaveValue(title)
    await page.getByLabel('Title').fill(`${title} edited`)
    await page.getByLabel('Description').fill('Bring the forms')
    await page.getByRole('button', { name: 'Save' }).click()

    await expect(page.getByText(`${title} edited`)).toBeVisible()
    await expect(page.getByText(title, { exact: true })).toBeHidden()

    await page.reload()
    await page.getByRole('button', { name: `Edit ${title} edited` }).click()
    await expect(page.getByLabel('Description')).toHaveValue('Bring the forms')
  })

  test('infers the kind of event and stores times on the server', async ({ page }, { project }) => {
    const title = uniqueTitle(project.name)
    await page.getByRole('button', { name: 'New event' }).click()
    await page.getByLabel('Title').fill(title)
    await page.getByLabel('Start date').fill('2026-12-01')
    await page.getByLabel('Start time').fill('09:30')
    await page.getByLabel('End time').fill('10:45')
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(
      page.getByRole('listitem').filter({ hasText: title }).getByText('2026-12-01 09:30'),
    ).toBeVisible()

    await page.reload()
    await page.getByRole('button', { name: `Edit ${title}` }).click()
    await expect(page.getByLabel('Start date')).toHaveValue('2026-12-01')
    await expect(page.getByLabel('Start time')).toHaveValue('09:30')
    await expect(page.getByLabel('End date')).toHaveValue('2026-12-01')
    await expect(page.getByLabel('End time')).toHaveValue('10:45')
  })

  test('opens the native picker when a date or time field is clicked', async ({ page }) => {
    const opened: string[] = []
    await page.exposeFunction('reportPicker', (type: string) => opened.push(type))
    await page.addInitScript(() => {
      HTMLInputElement.prototype.showPicker = function (this: HTMLInputElement) {
        ;(window as unknown as { reportPicker(type: string): void }).reportPicker(this.type)
      }
    })
    await page.goto('/')
    await page.getByRole('button', { name: 'New event' }).click()

    for (const label of ['Start date', 'Start time', 'End date', 'End time']) {
      await page.getByLabel(label).click()
    }

    expect(opened).toEqual(['date', 'time', 'date', 'time'])
  })

  test('grows the title box for a long title and keeps it on one line', async ({ page }) => {
    await page.getByRole('button', { name: 'New event' }).click()
    const title = page.getByLabel('Title')
    const height = () => title.evaluate((element) => element.getBoundingClientRect().height)
    const oneRow = await height()

    await title.fill('A very long title '.repeat(12))
    expect(await height()).toBeGreaterThan(oneRow * 2)

    await title.fill('Lunch')
    await title.press('Enter')
    await title.pressSequentially('with Sam')
    await expect(title).toHaveValue('Lunchwith Sam')
    expect(await height()).toBe(oneRow)
  })

  test('shows the derived durations', async ({ page }) => {
    await page.getByRole('button', { name: 'New event' }).click()
    await page.getByLabel('Start date').fill('2026-12-01')
    await page.getByLabel('End date').fill('2026-12-03')
    await expect(page.getByText('3 days')).toBeVisible()

    await page.getByLabel('End date').fill('2026-12-01')
    await page.getByLabel('Start time').fill('09:30')
    await page.getByLabel('End time').fill('11:00')
    await expect(page.getByText('1 h 30 min')).toBeVisible()

    // Over several days the days and the time beyond them are shown apart.
    await page.getByLabel('End date').fill('2026-12-03')
    await expect(page.getByText('2 days')).toBeVisible()
    await expect(page.getByText('1 h 30 min')).toBeVisible()
  })

  test('marks the end in red when it is before the start', async ({ page }) => {
    await page.getByRole('button', { name: 'New event' }).click()
    await page.getByLabel('Title').fill('Backwards')
    await page.getByLabel('Start date').fill('2026-12-05')
    await page.getByLabel('End date').fill('2026-12-01')

    await expect(page.getByLabel('End date')).toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByLabel('Start date')).not.toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('The end cannot be before the start')).toBeVisible()

    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('heading', { name: 'New event' })).toBeVisible()
  })

  test('writes to the chosen calendar and moves an event between calendars', async ({ page }, {
    project,
  }) => {
    const title = uniqueTitle(project.name)
    await page.getByRole('button', { name: 'New event' }).click()
    await page.getByLabel('Title').fill(title)
    await page.getByRole('combobox', { name: 'Calendar' }).click()
    await page.getByRole('option', { name: 'Work' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText(title)).toBeVisible()

    await page.reload()
    await page.getByRole('button', { name: `Edit ${title}` }).click()
    await expect(page.getByRole('combobox', { name: 'Calendar' })).toContainText('Work')

    await page.getByRole('combobox', { name: 'Calendar' }).click()
    await page.getByRole('option', { name: 'Calendar' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText(title)).toBeVisible()

    await page.reload()
    await page.getByRole('button', { name: `Edit ${title}` }).click()
    await expect(page.getByRole('combobox', { name: 'Calendar' })).toContainText('Calendar')
  })
})

test.describe('italian browser', () => {
  test.use({ locale: 'it-IT' })

  test('shows the app in Italian', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Connesso al server CalDAV')).toBeVisible()
    await page.getByRole('button', { name: 'Nuovo evento' }).click()
    await expect(page.getByRole('combobox', { name: 'Calendario' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Salva' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Indietro' })).toBeVisible()
  })
})
