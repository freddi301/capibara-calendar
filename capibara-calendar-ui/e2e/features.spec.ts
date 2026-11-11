import { expect, test, type Locator, type Page } from '@playwright/test'
import { ensureCalendar, icsDay, putEvent, removeEvent, setCalendarColor } from './calendars.ts'

// These tests talk to the real local Radicale server (started by playwright.config.ts).

test.use({ locale: 'en-US' })

test.beforeAll(async ({ request }) => {
  await ensureCalendar(request, 'calendar', 'Calendar')
  await ensureCalendar(request, 'work', 'Work')
})

const unique = (project: string, name: string) => `${name} ${project} ${Date.now()}`
const uid = (title: string) => title.replaceAll(' ', '-')

async function open(page: Page) {
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
}

async function chooseLayout(page: Page, name: string) {
  await page.getByRole('button', { name: 'Layouts' }).click()
  await page.getByRole('button', { name, exact: true }).click()
}

async function showMonth(page: Page) {
  await page.getByRole('button', { name: 'Show the month' }).click()
}

async function drag(page: Page, from: [number, number], to: [number, number]) {
  await page.mouse.move(...from)
  await page.mouse.down()
  await page.mouse.move(...to, { steps: 6 })
  await page.mouse.up()
}

const center = async (page: Page, name: string) => {
  const box = await page.getByRole('group', { name, exact: true }).boundingBox()
  if (!box) throw new Error(`No ${name}`)
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
    width: box.width,
    height: box.height,
  }
}

test.describe('events that repeat', () => {
  test('show every occurrence, are edited as one event, and go all together', async ({
    page,
    request,
  }, { project }) => {
    const title = unique(project.name, 'Repeats')
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`, 'RRULE:FREQ=WEEKLY;COUNT=3'],
    })
    try {
      await open(page)
      await chooseLayout(page, 'Agenda')
      const occurrences = page.getByRole('button', { name: title })
      await expect(occurrences).toHaveCount(3)

      // Any of them opens the event, with the day that it started on.
      await occurrences.nth(1).click()
      await page.getByRole('button', { name: 'All events' }).click()
      await expect(page.getByRole('heading', { name: 'Edit event' })).toBeVisible()
      await expect(
        page.getByText('This event repeats. Changes are made to all its occurrences.'),
      ).toBeVisible()
      const first = icsDay(0)
      await expect(page.getByLabel('Start date')).toHaveValue(
        `${first.slice(0, 4)}-${first.slice(4, 6)}-${first.slice(6)}`,
      )

      await page.getByRole('button', { name: 'Delete' }).click()
      await expect(page.getByText('It repeats: all its occurrences are deleted.')).toBeVisible()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()

      await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
      await expect(occurrences).toHaveCount(0)
    } finally {
      await removeEvent(request, 'calendar', uid(title))
    }
  })

  test('are changed one at a time, and one at a time taken out, without touching the others', async ({
    page,
    request,
  }, { project }) => {
    const title = unique(project.name, 'Pick')
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`, 'RRULE:FREQ=WEEKLY;COUNT=4'],
    })
    try {
      await open(page)
      await chooseLayout(page, 'Agenda')
      const occurrences = page.getByRole('button', { name: title })
      await expect(occurrences).toHaveCount(4)

      // Change the second one alone.
      await occurrences.nth(1).click()
      await page.getByRole('button', { name: 'Only this event' }).click()
      await expect(
        page.getByText('Only this event changes. The others of the repeat stay as they are.'),
      ).toBeVisible()
      await page.getByLabel('Title').fill(`${title} moved`)
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByRole('button', { name: `${title} moved` })).toHaveCount(1)
      await expect(page.getByRole('button', { name: title, exact: true })).toHaveCount(3)

      // Take the third one out alone: it was the last but one, and nothing else goes.
      await page.getByRole('button', { name: title, exact: true }).nth(1).click()
      await page.getByRole('button', { name: 'Only this event' }).click()
      await page.getByRole('button', { name: 'Delete' }).click()
      await expect(
        page.getByText('Only this event is deleted. The others of the repeat stay.'),
      ).toBeVisible()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
      await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
      await expect(page.getByRole('button', { name: title, exact: true })).toHaveCount(2)
      await expect(page.getByRole('button', { name: `${title} moved` })).toHaveCount(1)

      // Still true after the page is loaded again: it was written to the server.
      await page.reload()
      await expect(page.getByRole('button', { name: title, exact: true })).toHaveCount(2)
      await expect(page.getByRole('button', { name: `${title} moved` })).toHaveCount(1)
    } finally {
      await removeEvent(request, 'calendar', uid(title))
    }
  })

  test('are made from an event, and stop at the day that was said', async ({ page }, {
    project,
  }) => {
    const title = unique(project.name, 'Make')
    await open(page)
    await page.getByRole('button', { name: 'New event' }).click()
    await page.getByRole('combobox', { name: 'Calendar' }).click()
    await page.getByRole('option').first().click()
    await page.getByLabel('Title').fill(title)
    await page.getByRole('combobox', { name: 'Repeat', exact: true }).click()
    await page.getByRole('option', { name: 'Day', exact: true }).click()
    await page.getByRole('combobox', { name: 'How the repeat ends' }).click()
    await page.getByRole('option', { name: 'Ends on' }).click()
    const last = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await page.getByLabel('Repeat until').fill(last)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()

    await chooseLayout(page, 'Agenda')
    await expect(page.getByRole('button', { name: title })).toHaveCount(4) // today and three days

    // And the repeat is taken away from all of them: one is left.
    await page.getByRole('button', { name: title }).first().click()
    await page.getByRole('button', { name: 'All events' }).click()
    await page.getByRole('combobox', { name: 'Repeat', exact: true }).click()
    await page.getByRole('option', { name: 'Does not repeat' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
    await expect(page.getByRole('button', { name: title })).toHaveCount(1)

    await page.getByRole('button', { name: title }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('button', { name: title })).toHaveCount(0)
  })

  test('are shown on each day of the repeat, and no more than that', async ({ page, request }, {
    project,
  }) => {
    const title = unique(project.name, 'Daily')
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`, 'RRULE:FREQ=DAILY;COUNT=20'],
    })
    try {
      await open(page)
      await chooseLayout(page, 'Agenda')

      await expect(page.getByRole('button', { name: title })).toHaveCount(20)
    } finally {
      await removeEvent(request, 'calendar', uid(title))
    }
  })
})

test('asks the server only for the days that are shown', async ({ page }) => {
  const days = (body: string) => {
    const [, start, end] = /time-range start="(\d{8})T\d+Z" end="(\d{8})T\d+Z"/.exec(body) ?? []
    const toDate = (value: string) =>
      Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6)))
    return (toDate(end) - toDate(start)) / (24 * 60 * 60 * 1000)
  }
  const ranges: number[] = []
  page.on('request', (request) => {
    const body = request.postData()
    if (request.method() === 'REPORT' && body?.includes('time-range')) ranges.push(days(body))
  })

  await open(page)
  // A week, with a day before it and two after it, for the events of the other time zones.
  await expect.poll(() => ranges.at(-1)).toBe(9)

  await showMonth(page)
  await expect.poll(() => ranges.at(-1)).toBeGreaterThanOrEqual(30)
  expect(ranges.at(-1)).toBeLessThanOrEqual(44)
  expect(ranges.every((range) => range < 400)).toBe(true) // never the whole calendar
})

test.describe('swipes', () => {
  test('of the week go to the next week and the one before', async ({ page }) => {
    await open(page)
    const date = page.getByLabel('Choose a date')
    const today = await date.inputValue()
    const week = await center(page, 'Week')

    await drag(page, [week.x + week.width / 3, week.y], [week.x - week.width / 3, week.y])
    const next = new Date(Date.parse(today) + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await expect(date).toHaveValue(next)

    await drag(page, [week.x - week.width / 3, week.y], [week.x + week.width / 3, week.y])
    await expect(date).toHaveValue(today)
  })

  test('of the month go to the next month and the one before', async ({ page }) => {
    await open(page)
    await showMonth(page)
    const month = page.getByRole('combobox', { name: /^Month/ })
    const name = (offset: number) => {
      const now = new Date()
      return new Date(now.getFullYear(), now.getMonth() + offset, 1).toLocaleString('en-US', {
        month: 'long',
      })
    }
    await expect(month).toContainText(name(0))
    const table = await center(page, 'Month')

    await drag(page, [table.x, table.y + table.height / 3], [table.x, table.y - table.height / 3])
    await expect(month).toContainText(name(1))

    await drag(page, [table.x, table.y - table.height / 3], [table.x, table.y + table.height / 3])
    await expect(month).toContainText(name(0))
    await drag(page, [table.x, table.y - table.height / 3], [table.x, table.y + table.height / 3])
    await expect(month).toContainText(name(-1))
  })
})

test.describe('the place that is remembered', () => {
  test('is the layout and the day', async ({ page }) => {
    await open(page)
    await showMonth(page)
    const month = page.getByRole('group', { name: 'Month', exact: true })
    await month.getByRole('button', { pressed: false }).nth(12).click()
    const day = await page.getByLabel('Choose a date').inputValue()

    await page.reload()

    await expect(page.getByRole('group', { name: 'Month', exact: true })).toBeVisible()
    await expect(page.getByLabel('Choose a date')).toHaveValue(day)
  })

  test('is the screen, and goes back to the list from it', async ({ page }) => {
    await open(page)
    await chooseLayout(page, 'Agenda')
    await page.getByRole('button', { name: 'Filter' }).click()
    await expect(page.getByRole('heading', { name: 'Filter' })).toBeVisible()

    await page.reload()

    await expect(page.getByRole('heading', { name: 'Filter' })).toBeVisible()
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByRole('group', { name: 'Week', exact: true })).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
    await page.getByRole('button', { name: 'Layouts' }).click()
    await expect(page.getByRole('button', { name: 'Agenda' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  test('is not an event that was open when it was saved', async ({ page }, { project }) => {
    await open(page)
    await page.getByRole('button', { name: 'New event' }).click()
    await page.getByLabel('Title').fill(unique(project.name, 'Remember'))
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()

    await page.reload()

    await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
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

      await page.getByRole('button', { name: 'Filter' }).click()
      await expect(page.getByRole('switch', { name: 'Work' })).toBeChecked() // all are shown
      await page.getByRole('switch', { name: 'Work' }).click()
      await expect(page.getByRole('switch', { name: 'Work' })).not.toBeChecked()
      await page.getByRole('button', { name: 'Back' }).click()

      await expect(page.getByRole('button', { name: mine })).toBeVisible()
      await expect(page.getByRole('button', { name: work })).toHaveCount(0)

      // Remembered by the browser.
      await page.reload()
      await expect(page.getByRole('button', { name: mine })).toBeVisible()
      await expect(page.getByRole('button', { name: work })).toHaveCount(0)

      await page.getByRole('button', { name: 'Filter' }).click()
      await page.getByRole('button', { name: 'Hide all' }).click()
      await expect(page.getByRole('switch', { name: 'Calendar' })).not.toBeChecked()
      await page.getByRole('button', { name: 'Back' }).click()
      await expect(page.getByRole('button', { name: mine })).toHaveCount(0)

      await page.getByRole('button', { name: 'Filter' }).click()
      await page.getByRole('button', { name: 'Show all' }).click()
      await expect(page.getByRole('switch', { name: 'Work' })).toBeChecked()
      await page.getByRole('button', { name: 'Back' }).click()
      await expect(page.getByRole('button', { name: mine })).toBeVisible()
      await expect(page.getByRole('button', { name: work })).toBeVisible()
    } finally {
      await removeEvent(request, 'calendar', uid(mine))
      await removeEvent(request, 'work', uid(work))
    }
  })
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

      await expect(page.getByRole('alert')).toHaveText(/changed on the server after you opened it/)
      await expect(page.getByRole('button', { name: 'Try again' })).toHaveCount(0)
    } finally {
      await removeEvent(request, 'calendar', uid(title))
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
      await page.reload()
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

test.describe('the colors of the calendars', () => {
  const edge = (scope: ReturnType<Page['locator']>) =>
    scope.locator('[data-slot="calendar-color"]').first()
  const colorOf = (element: ReturnType<Page['locator']>) =>
    element.evaluate((node) => getComputedStyle(node).borderLeftColor)

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
      await expect(item).toHaveCSS('border-left-color', 'rgb(255, 0, 0)')
      await expect(item).toHaveCSS('border-left-width', '4px')

      await page.getByRole('button', { name: 'Filter' }).click()
      await expect(page.locator('[data-slot="calendar-color"]', { hasText: name })).toHaveCSS(
        'border-left-color',
        'rgb(255, 0, 0)',
      )
      await page.getByRole('button', { name: 'Back' }).click()

      await page.getByRole('button', { name: 'New event' }).click()
      const select = page.getByRole('combobox', { name: 'Calendar' })
      await select.click()
      const option = page.getByRole('option', { name })
      await expect(option).toHaveCSS('border-left-color', 'rgb(255, 0, 0)')
      await option.click()
      await expect(select).toHaveCSS('border-left-color', 'rgb(255, 0, 0)')
      await expect(select).toHaveCSS('border-left-width', '4px')
    } finally {
      await removeEvent(request, slug, uid(title))
      await setCalendarColor(request, slug, undefined)
    }
  })

  test('are the ones of the palette, different for each calendar, when the server has none', async ({
    page,
  }) => {
    // Calendar and Work have no color on the server: no test gives them one.
    await open(page)

    await page.getByRole('button', { name: 'Filter' }).click()
    const first = await colorOf(
      page.locator('[data-slot="calendar-color"]', { hasText: /^Calendar$/ }),
    )
    const second = await colorOf(
      page.locator('[data-slot="calendar-color"]', { hasText: /^Work$/ }),
    )

    expect(first).toMatch(/^rgb\(/)
    expect(second).toMatch(/^rgb\(/)
    expect(first).not.toBe(second)
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

    await page.getByRole('button', { name: 'Back' }).click()
    await expect(page.getByText('Discard your changes?')).toBeVisible()
    await page.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page.getByLabel('Title')).toHaveValue(title) // still there

    await page.getByRole('button', { name: 'Back' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Discard' }).click()
    await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
    await expect(page.getByText(title)).toHaveCount(0) // not saved
  })

  test('does not ask when nothing was changed', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'New event' }).click()
    await expect(page.getByRole('button', { name: 'Save' })).toBeVisible()

    await page.getByRole('button', { name: 'Back' }).click()

    await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
    await expect(page.getByText('Discard your changes?')).toHaveCount(0)
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
    await page.getByRole('button', { name: 'Filter' }).click()
    await page.getByRole('button', { name: 'New calendar' }).click()
    await expect(page.getByRole('heading', { name: 'New calendar' })).toBeVisible()

    await page.getByLabel('Name').fill(name)
    await page.getByRole('button', { name: 'Violet' }).click()
    await page.getByRole('button', { name: 'Save' }).click()

    const row = page.locator('[data-slot="calendar-color"]', { hasText: name })
    await expect(row).toBeVisible()
    await expect(row).toHaveCSS('border-left-color', 'rgb(124, 58, 237)')

    // Open it by pressing its name, and change the name and the color.
    await row.getByRole('button', { name }).click()
    await expect(page.getByRole('heading', { name: 'Edit calendar' })).toBeVisible()
    await page.getByLabel('Name').fill(`${name} renamed`)
    await page.getByRole('button', { name: 'Teal' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    const renamed = page.locator('[data-slot="calendar-color"]', { hasText: `${name} renamed` })
    await expect(renamed).toBeVisible()
    await expect(renamed).toHaveCSS('border-left-color', 'rgb(13, 148, 136)')

    // Pressing the switch hides it, and does not open it.
    await renamed.getByRole('switch').click()
    await expect(page.getByRole('heading', { name: 'Filter' })).toBeVisible()
    await expect(renamed.getByRole('switch')).not.toBeChecked()
    await renamed.getByRole('switch').click()

    // And it goes, with the question first.
    await renamed.getByRole('button', { name: `${name} renamed` }).click()
    await page.getByRole('button', { name: 'Delete' }).click()
    await expect(
      page.getByText('All its events are deleted with it. This cannot be undone.'),
    ).toBeVisible()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expect(page.getByRole('heading', { name: 'Filter' })).toBeVisible()
    await expect(page.getByText(`${name} renamed`)).toHaveCount(0)

    // Gone from the server too, not only from the page.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Filter' })).toBeVisible()
    await expect(page.getByText(`${name} renamed`)).toHaveCount(0)
  })

  test('asks before the calendar is left with changes', async ({ page }) => {
    await open(page)
    await page.getByRole('button', { name: 'Filter' }).click()
    await page.getByRole('button', { name: 'New calendar' }).click()
    await page.getByLabel('Name').fill('Draft calendar')

    await page.getByRole('button', { name: 'Back' }).click()

    await expect(page.getByText('Discard your changes?')).toBeVisible()
    await page.getByRole('button', { name: 'Keep editing' }).click()
    await expect(page.getByLabel('Name')).toHaveValue('Draft calendar')
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
    await page.getByRole('button', { name: 'Filter' }).click()
    await page.getByRole('button', { name: 'New calendar' }).click()

    const text = await height(page.getByLabel('Name'))
    expect(text).toBeGreaterThan(0)
    expect(await height(page.getByLabel('Custom color'))).toBe(text)
  })
})
