import type { Page } from '@playwright/test'
import { expect, test } from '../fixtures.ts'
import { ensureCalendar, findEvent, icsDay, putEvent, removeFound } from '../calendars.ts'

// These tests talk to the real local Radicale server (started by playwright.config.ts).

test.use({ locale: 'en-US' })

test.beforeAll(async ({ request }) => {
  await ensureCalendar(request, 'calendar', 'Calendar')
})

const unique = (project: string, name: string) => `Coordinates ${name} ${project} ${Date.now()}`
const uid = (title: string) => title.replaceAll(' ', '-')
const geoOf = (ics: string) => ics.split(/\r?\n/).find((line) => line.startsWith('GEO')) ?? ''

async function openForEdit(page: Page, title: string) {
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
  await page.getByRole('button', { name: title }).click()
  await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
  await expect(page.getByRole('heading', { name: 'Edit event' })).toBeVisible()
}

async function save(page: Page) {
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
}

test.describe('the coordinates of an event', () => {
  test('are read from the GEO of the server, and open the maps app from the event', async ({
    page,
    request,
  }, { project }) => {
    const title = unique(project.name, 'read')
    // given
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`, 'LOCATION:Villa', 'GEO:44.38;9.04'],
    })
    try {
      // when
      await page.goto('/')
      await page.getByRole('button', { name: title }).click()

      // then
      await expect(
        page.getByRole('link', { name: 'Open the coordinates in the maps app' }),
      ).toHaveAttribute('href', 'geo:44.38,9.04')
    } finally {
      await removeFound(request, 'calendar', title)
    }
  })

  test('are written to the GEO of the server when they are edited, and taken away when they are cleared', async ({
    page,
    request,
  }, { project }) => {
    const title = unique(project.name, 'edit')
    // given
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`, 'LOCATION:Villa', 'GEO:44.38;9.04'],
    })
    try {
      // when
      await openForEdit(page, title)
      await page.getByRole('button', { name: 'Coordinates' }).click()
      await page.getByRole('textbox', { name: 'Coordinates' }).fill('45.46, 9.19')
      await page.keyboard.press('Enter')
      await save(page)

      // then
      const moved = (await findEvent(request, 'calendar', title))?.ics ?? ''
      expect(geoOf(moved)).toBe('GEO:45.46;9.19')
      expect(moved).toContain('LOCATION:Villa')

      // when: the coordinates are cleared
      await page.getByRole('button', { name: 'Edit' }).click()
      await page.getByRole('button', { name: 'Coordinates' }).click()
      await page.getByRole('textbox', { name: 'Coordinates' }).fill('')
      await page.keyboard.press('Enter')
      await save(page)

      // then
      const cleared = (await findEvent(request, 'calendar', title))?.ics ?? ''
      expect(geoOf(cleared)).toBe('')
      expect(cleared).toContain('LOCATION:Villa')
    } finally {
      await removeFound(request, 'calendar', title)
    }
  })

  test('stay on the server when only the name of the place is changed', async ({ page, request }, {
    project,
  }) => {
    const title = unique(project.name, 'name')
    // given
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [
        `DTSTART;VALUE=DATE:${icsDay(0)}`,
        'LOCATION:Villa',
        'GEO:44.38221763037996;9.04328792627319',
      ],
    })
    try {
      // when
      await openForEdit(page, title)
      await page.getByLabel('Location').fill('Villa Groppallo')
      await save(page)

      // then
      const stored = (await findEvent(request, 'calendar', title))?.ics ?? ''
      expect(stored).toContain('LOCATION:Villa Groppallo')
      expect(geoOf(stored)).toBe('GEO:44.38221763037996;9.04328792627319')
    } finally {
      await removeFound(request, 'calendar', title)
    }
  })
})
