import { expect, test, type Page } from '@playwright/test'
import { ensureCalendar } from './calendars.ts'

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

    await title.fill('A very long title '.repeat(40))
    expect(await height()).toBeGreaterThan(oneRow * 2)

    await title.fill('Lunch')
    await title.press('Enter')
    await title.pressSequentially('with Sam')
    await expect(title).toHaveValue('Lunchwith Sam')
    expect(await height()).toBe(oneRow)
  })

  test('starts a new event on the day that is selected', async ({ page }) => {
    await page.getByRole('group', { name: 'Week' }).getByRole('button').last().click()
    const selected = await page.getByLabel('Choose a date').inputValue()

    await page.getByRole('button', { name: 'New event' }).click()

    await expect(page.getByLabel('Start date')).toHaveValue(selected)
  })

  test('picks the month and the year from lists, and goes back to today', async ({ page }) => {
    const date = page.getByLabel('Choose a date')
    const today = await date.inputValue()

    await page.getByRole('combobox', { name: /^Month/ }).click()
    await page.getByRole('option', { name: 'December' }).click()
    expect(await date.inputValue()).toMatch(/^\d{4}-12-\d{2}$/)

    await page.getByRole('combobox', { name: /^Year/ }).click()
    await page.getByRole('option', { name: '2031', exact: true }).click()
    expect(await date.inputValue()).toMatch(/^2031-12-/)

    await page.getByRole('button', { name: 'Today' }).click()
    await expect(date).toHaveValue(today)
  })

  test('shows the date as day, month and year, with the week below it', async ({ page }) => {
    const header = page.getByLabel('Choose a date').locator('..').locator('..')
    await expect(header.getByRole('combobox', { name: /^Month/ })).toBeVisible()
    await expect(header.getByRole('combobox', { name: /^Year/ })).toBeVisible()
    // The name of the weekday is the one line above the date: the day, the month and the year are in the fields.
    await expect(header).toContainText(
      /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)/,
    )
    await expect(page.getByRole('group', { name: 'Week' }).getByRole('button')).toHaveCount(7)
  })

  test('keeps the date and the week in place, only the events scroll', async ({ page }) => {
    const week = page.getByRole('group', { name: 'Week' })
    const top = (await week.boundingBox())?.y

    const list = page.locator('section')
    await expect(list).toHaveCSS('overflow-y', 'auto')
    await list.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })

    expect((await week.boundingBox())?.y).toBe(top)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= document.documentElement.clientHeight,
      ),
    ).toBe(true) // the page itself does not scroll
  })

  test('keeps the month where it is when the day goes from one digit to two', async ({ page }) => {
    const month = page.getByRole('combobox', { name: /^Month/ })

    await page.getByLabel('Choose a date').fill('2026-12-09')
    const x = (await month.boundingBox())?.x
    await page.getByLabel('Choose a date').fill('2026-12-10')
    expect((await month.boundingBox())?.x).toBe(x)
    await page.getByLabel('Choose a date').fill('2026-12-31')
    expect((await month.boundingBox())?.x).toBe(x)
  })

  test('has the round button on the line under the week, that makes it the month and back', async ({
    page,
  }, { project }) => {
    const title = uniqueTitle(project.name)
    await createEvent(page, title) // on today, the selected day
    const selected = await page.getByLabel('Choose a date').inputValue()

    // The Days are the layout at first, with the week above them.
    await page.getByRole('button', { name: 'Layouts' }).click()
    await expect(page.getByRole('button', { name: 'Days', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await page.getByRole('button', { name: /^(Back|Close)$/ }).click()
    const week = page.getByRole('group', { name: 'Week' })
    await expect(week).toBeVisible()

    // The button is on the right, on the line that ends the week.
    const toggle = page.getByRole('button', { name: 'Show the month' })
    const line = await week.boundingBox()
    const circle = await toggle.boundingBox()
    if (!line || !circle) throw new Error('No week, or no button')
    expect(circle.x + circle.width / 2).toBeGreaterThan(line.x + line.width / 2)
    expect(Math.abs(circle.y + circle.height / 2 - (line.y + line.height))).toBeLessThan(14)

    await toggle.click()
    const month = page.getByRole('group', { name: 'Month' })
    await expect(month.getByRole('button').first()).toBeVisible()
    expect(await month.getByRole('button').count()).toBe(42) // always six weeks
    await expect(page.getByLabel('Choose a date')).toHaveValue(selected)
    await expect(page.getByText(title)).toBeVisible()
    await expect(month.getByRole('button', { pressed: true })).toHaveCount(1)

    // Another day of the table shows its own events, and the month is above the days still.
    await month.getByRole('button', { pressed: false }).nth(3).click()
    await expect(page.getByLabel('Choose a date')).not.toHaveValue(selected)
    await expect(month).toBeVisible()

    await page.getByRole('button', { name: 'Show the week' }).click()
    await expect(page.getByRole('group', { name: 'Week' })).toBeVisible()
  })

  test('shows the week as rows that fill the screen, and drags to the next week', async ({ page }, {
    project,
  }) => {
    const title = uniqueTitle(project.name)
    await createEvent(page, title) // on today, the selected day
    const selected = await page.getByLabel('Choose a date').inputValue()

    await page.getByRole('button', { name: 'Layouts' }).click()
    await page.getByRole('button', { name: 'Week', exact: true }).click()

    const rows = page.getByRole('group').filter({ hasText: /\d/ })
    await expect(rows).toHaveCount(7)
    await expect(page.getByRole('button', { name: title })).toBeVisible()
    expect(
      await page.evaluate(
        () => document.documentElement.scrollHeight <= document.documentElement.clientHeight,
      ),
    ).toBe(true) // the seven days share the screen, the page does not scroll

    // The rows have the same height, whether or not they have events.
    const heights = await rows.evaluateAll((items) =>
      items.map((item) => Math.round(item.getBoundingClientRect().height)),
    )
    expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1)

    // Dragging up goes to the next week: the weeks are one above the other.
    const box = await rows.first().boundingBox()
    if (!box) throw new Error('No row')
    const x = box.x + 20 // on the day, where there is no card
    await page.mouse.move(x, box.y + box.height * 4)
    await page.mouse.down()
    await page.mouse.move(x, box.y + box.height, { steps: 8 })
    await page.mouse.up()
    const week = 7 * 24 * 60 * 60 * 1000
    const next = new Date(Date.parse(selected) + week).toISOString().slice(0, 10)
    await expect(page.getByLabel('Choose a date')).toHaveValue(next)
  })

  test('shows the date line on the agenda, following the scroll', async ({ page }, { project }) => {
    // Events on days after each other, so that the list has days to scroll through.
    const day = (offset: number) =>
      new Date(Date.now() + offset * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    for (const offset of [0, 3, 6]) {
      await page.getByRole('button', { name: 'New event' }).click()
      await page.getByLabel('Title').fill(`Agenda ${project.name} ${offset} ${Date.now()}`)
      await page.getByLabel('Start date').fill(day(offset))
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByRole('button', { name: 'New event' })).toBeVisible()
    }
    await page.getByRole('button', { name: 'Layouts' }).click()
    await page.getByRole('button', { name: 'Agenda' }).click()
    // A window as short as the list, so that there is something to scroll, whatever else is on the server.
    const size = page.viewportSize() ?? { width: 1280, height: 720 }
    await page.setViewportSize({ width: size.width, height: 240 })

    const date = page.getByLabel('Choose a date')
    const first = await date.inputValue()
    await expect(page.getByRole('heading', { level: 2 }).first()).toBeVisible()

    // Scrolling to the end of the list moves the date to a later day.
    const list = page.locator('section')
    await list.evaluate((element) => {
      element.scrollTop = element.scrollHeight
    })
    await expect.poll(async () => (await date.inputValue()) > first).toBe(true)

    // Choosing a date starts the list on it, at the top. The first day is not the one that the
    // scrolling reached, so choosing it is a change.
    await date.fill(first)
    await expect(date).toHaveValue(first)
    await expect.poll(() => list.evaluate((element) => element.scrollTop)).toBe(0)
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
