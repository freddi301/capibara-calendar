import { expect, type Page } from '@playwright/test'
import { icsDay } from '../calendars.ts'

// The days of the agenda are in lanes on a wide window: the occurrences are found by their day, and
// not by their place in the page.
const dayOf = (daysAhead: number) => {
  const day = icsDay(daysAhead)
  return `${day.slice(0, 4)}-${day.slice(4, 6)}-${day.slice(6)}`
}
export const occurrenceOn = (page: Page, title: string, daysAhead: number) =>
  page.locator(`[data-day="${dayOf(daysAhead)}"]`).getByRole('button', { name: title })

/** The agenda makes only the days on the screen: to count what is in it, it is scrolled by hand from the top to the end. */
async function countInAgenda(page: Page, name: string, isExact: boolean) {
  return page.locator('[data-vt="events"]').evaluate(
    async (list, { name, isExact }) => {
      const found = new Set<string>()
      const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
      list.scrollTop = 0
      for (let step = 0; step < 80; step++) {
        list.dispatchEvent(new WheelEvent('wheel', { bubbles: true })) // the person is scrolling: the list stays where it is put
        await frame()
        await frame()
        for (const row of list.querySelectorAll<HTMLElement>('[data-day]')) {
          for (const button of row.querySelectorAll('button')) {
            const label = button.getAttribute('aria-label') ?? button.textContent
            const isFound = isExact ? label.trim() === name : label.includes(name)
            if (isFound) found.add(`${row.dataset.day ?? ''} ${label}`)
          }
        }
        if (list.scrollTop + list.clientHeight >= list.scrollHeight - 1) break
        list.scrollTop += list.clientHeight / 2
      }
      return found.size
    },
    { name, isExact },
  )
}

export const expectInAgenda = (page: Page, name: string, count: number, isExact = false) =>
  expect.poll(() => countInAgenda(page, name, isExact), { timeout: 30_000 }).toBe(count)

/** The days of the agenda that are not on the screen are not made: the date line brings the list to them. */
export const showDay = (page: Page, daysAhead: number) =>
  page.getByLabel('Choose a date').fill(dayOf(daysAhead))

// These tests talk to the real local Radicale server (started by playwright.config.ts).
