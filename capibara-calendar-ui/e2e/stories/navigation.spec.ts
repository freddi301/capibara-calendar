import { expect, test } from '@playwright/test'
import { ensureCalendar, icsDay, putEvent, removeEvent } from '../calendars.ts'
import { reload, unique, uid, open, chooseLayout, showMonth, drag, center } from '../support/app.ts'

// These tests talk to the real local Radicale server (started by playwright.config.ts).

test.use({ locale: 'en-US' })

test.beforeAll(async ({ request }) => {
  await ensureCalendar(request, 'calendar', 'Calendar')
  await ensureCalendar(request, 'work', 'Work')
})

test('asks the server only for the months that are shown', async ({ page }) => {
  const days = (body: string) => {
    const [, start, end] = /time-range start="(\d{8})T\d+Z" end="(\d{8})T\d+Z"/.exec(body) ?? []
    const toDate = (value: string) =>
      Date.UTC(Number(value.slice(0, 4)), Number(value.slice(4, 6)) - 1, Number(value.slice(6)))
    return (toDate(end) - toDate(start)) / (24 * 60 * 60 * 1000)
  }
  const ranges: number[] = []
  const calendars = new Set<string>()
  page.on('request', (request) => {
    const body = request.postData()
    if (request.method() !== 'REPORT' || !body?.includes('time-range')) return
    ranges.push(days(body))
    calendars.add(request.url())
  })

  await open(page)
  // The months of the agenda, and the month before and the one after them: six requests for the calendar.
  await expect.poll(() => ranges.length).toBeGreaterThan(0)
  await expect.poll(() => ranges.length).toBeGreaterThanOrEqual(6 * calendars.size)
  await showMonth(page)
  await expect(page.getByRole('group', { name: 'Month' })).toBeVisible()

  // A month, with a day before it and two after it, for the events of the other time zones.
  expect(ranges.every((range) => range >= 30 && range <= 35)).toBe(true)
  // The agenda reads on, three months at a time, while its list is short: up to a year each way.
  expect(ranges.length).toBeLessThanOrEqual(30 * calendars.size) // never one for each page
})

test.describe('swipes', () => {
  test('of the week page the week, and the one before, without choosing a day', async ({
    page,
  }) => {
    await open(page)
    const date = page.getByLabel('Choose a date')
    const today = await date.inputValue()
    const week = await center(page, 'Week')
    const first = () =>
      page
        .getByRole('group', { name: 'Week', exact: true })
        .getByRole('button')
        .first()
        .evaluate((button) => button.textContent)
    const thisWeek = await first()

    await drag(page, [week.x + week.width / 3, week.y], [week.x - week.width / 3, week.y])
    await expect.poll(first).not.toBe(thisWeek)
    await expect(date).toHaveValue(today) // the day that is selected is the same

    await drag(page, [week.x - week.width / 3, week.y], [week.x + week.width / 3, week.y])
    await expect.poll(first).toBe(thisWeek)
    await expect(date).toHaveValue(today)
  })

  test('of the month page the month, and the one before, without choosing a day', async ({
    page,
  }) => {
    await open(page)
    await showMonth(page)
    const date = page.getByLabel('Choose a date')
    const today = await date.inputValue()
    const table = await center(page, 'Month')
    const first = () =>
      page
        .getByRole('group', { name: 'Month', exact: true })
        .getByRole('button')
        .first()
        .evaluate((button) => button.textContent)
    const thisMonth = await first()

    await drag(page, [table.x, table.y + table.height / 3], [table.x, table.y - table.height / 3])
    await expect.poll(first).not.toBe(thisMonth)
    await expect(date).toHaveValue(today)

    await drag(page, [table.x, table.y - table.height / 3], [table.x, table.y + table.height / 3])
    await expect.poll(first).toBe(thisMonth)
    await expect(date).toHaveValue(today)
  })
})

test.describe('the place that is remembered', () => {
  test('is the layout and the day', async ({ page }) => {
    await open(page)
    await showMonth(page)
    const month = page.getByRole('group', { name: 'Month', exact: true })
    await month.getByRole('button', { pressed: false }).nth(12).click()
    const day = await page.getByLabel('Choose a date').inputValue()

    await reload(page)

    await expect(page.getByRole('group', { name: 'Month', exact: true })).toBeVisible()
    await expect(page.getByLabel('Choose a date')).toHaveValue(day)
  })

  test('is the screen, and goes back to the list from it', async ({ page }) => {
    await open(page)
    await chooseLayout(page, 'Agenda')
    await page.getByRole('button', { name: 'Calendars' }).click()
    await expect(page.getByRole('heading', { name: 'Calendars' })).toBeVisible()

    await page.reload()

    await expect(page.getByRole('heading', { name: 'Calendars' })).toBeVisible()
    await page.getByRole('button', { name: /^(Back|Close)$/ }).click()
    await expect(page.getByLabel('Choose a date')).toBeVisible()
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

    await reload(page)

    await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
  })
})

test.describe('the timeline', () => {
  test('puts the events that overlap side by side, and opens one', async ({ page, request }, {
    project,
  }) => {
    const long = unique(project.name, 'Timeline long')
    const short = unique(project.name, 'Timeline short')
    const day = icsDay(0)
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(long),
      title: long,
      lines: [`DTSTART:${day}T090000`, `DTEND:${day}T100000`],
    })
    // Five minutes, in the middle of the other: it is as high as a line of its title, and beside it.
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(short),
      title: short,
      lines: [`DTSTART:${day}T093000`, `DTEND:${day}T093500`],
    })
    try {
      await open(page)
      await chooseLayout(page, 'Timeline day')
      const first = page.getByRole('button', { name: long })
      const second = page.getByRole('button', { name: short })
      await expect(first).toBeVisible()
      await expect(second).toBeVisible()
      const [one, two] = await Promise.all([first.boundingBox(), second.boundingBox()])
      if (!one || !two) throw new Error('The events are not on the screen')
      expect(two.height).toBeGreaterThanOrEqual(40)
      expect(one.x + one.width).toBeLessThanOrEqual(two.x + 4)

      await second.click()
      await expect(page.getByRole('heading', { name: 'Event' })).toBeVisible()
      await page.keyboard.press('Escape') // it closes the event, and the timeline is back
      await expect(first).toBeVisible()
    } finally {
      await removeEvent(request, 'calendar', uid(long))
      await removeEvent(request, 'calendar', uid(short))
    }
  })
})

test.describe('where the list was', () => {
  // The screen of the list is made again when an event was over it: it is as it was left.
  test('is kept by the agenda, and by the timeline, when an event is opened and closed', async ({
    page,
    request,
  }, { project }) => {
    // given
    const title = unique(project.name, 'Kept scroll')
    const days = Array.from({ length: 14 }, (_, index) => index)
    for (const day of days) {
      await putEvent(request, {
        slug: 'calendar',
        uid: `${uid(title)}-${day}`,
        title,
        lines: [`DTSTART:${icsDay(day)}T090000`, `DTEND:${icsDay(day)}T100000`],
      })
    }
    try {
      // when
      await open(page)
      await chooseLayout(page, 'Agenda')
      const list = page.locator('[data-vt="events"]')
      const scrollTop = () => list.evaluate((element) => element.scrollTop)
      // The list is made again from the day that was at its top, so its place is the day, not the pixels.
      const topDay = () =>
        list.evaluate((element) => {
          const edge = element.getBoundingClientRect().top
          const days = [...element.querySelectorAll<HTMLElement>('[data-day]')]
          return days.find((day) => day.getBoundingClientRect().bottom > edge + 1)?.dataset.day
        })
      await expect(page.getByRole('button', { name: title }).first()).toBeVisible()
      await list.hover()
      await page.mouse.wheel(0, 500)
      await expect.poll(scrollTop).toBeGreaterThan(0)
      const event = page.getByRole('button', { name: title }).nth(3)
      await event.scrollIntoViewIfNeeded() // the click would do it, and move the list
      await page.waitForTimeout(300) // the list is still moving
      const kept = await topDay()

      await event.click()
      await page.getByRole('button', { name: /^(Back|Close)$/ }).click()
      await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()

      // then
      await expect.poll(topDay).toBe(kept)

      // A timeline: how far into the day it was.
      await chooseLayout(page, 'Timeline day')
      const timeline = page.locator('[data-slot=timeline]')
      await expect(page.getByRole('button', { name: title }).first()).toBeVisible()
      await timeline.evaluate((element) => {
        element.scrollTop += 300
      })
      const before = await timeline.evaluate((element) => element.scrollTop)
      await page.getByRole('button', { name: title }).first().click()
      await page.getByRole('button', { name: /^(Back|Close)$/ }).click()
      await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
      await expect.poll(() => timeline.evaluate((element) => element.scrollTop)).toBe(before)
    } finally {
      for (const day of days) await removeEvent(request, 'calendar', `${uid(title)}-${day}`)
    }
  })
})
