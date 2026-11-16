import { expect, test } from './fixtures.ts'
import { ensureCalendar, findEvent, icsDay, putEvent, removeFound } from './calendars.ts'
import { readFile } from 'node:fs/promises'
import type { Page } from '@playwright/test'

// Importing a calendar file into a calendar, and exporting a calendar as a file, on the real server.

test.use({ locale: 'en-US' })

test.beforeAll(async ({ request }) => {
  await ensureCalendar(request, 'calendar', 'Calendar')
})

const fileOf = (uid: string, title: string, sequence: number) =>
  [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//e2e//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    'DTSTAMP:20260101T000000Z',
    `SEQUENCE:${sequence}`,
    `SUMMARY:${title}`,
    `DTSTART;VALUE=DATE:${icsDay(1)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')

async function openScreen(page: Page, button: 'Import' | 'Export') {
  await page.goto('/')
  const calendars = page.getByRole('button', { name: 'Calendars' })
  const own = page.getByRole('button', { name: button, exact: true })
  const picker = page.getByRole('combobox', { name: 'Calendar' })
  // The app opens on the screen that it was on: the list, the calendars, or the screen itself.
  await expect(calendars.or(own).or(picker).first()).toBeVisible()
  if (await calendars.isVisible()) await calendars.click()
  // The screen has a button of its own with this name, so the one of the list is looked for only until the screen shows.
  if (!(await picker.isVisible()) && (await own.isVisible())) await own.click()
  await picker.click()
  await page.getByRole('option', { name: 'Calendar', exact: true }).click()
}

async function chooseFile(page: Page, text: string) {
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('button', { name: /^Choose (a|another) file$/ }).click(),
  ])
  await chooser.setFiles({ name: 'e2e.ics', mimeType: 'text/calendar', buffer: Buffer.from(text) })
  await expect(page.getByText('File: e2e.ics')).toBeVisible()
}

const row = (page: Page, name: RegExp) =>
  page.getByRole('region', { name: 'What will be imported' }).getByRole('row', { name })

test('imports a file into a calendar, leaves it alone when it is imported again, and replaces it with a newer one', async ({
  page,
  request,
}, { project }) => {
  const uid = `e2e-import-${project.name}-${Date.now()}`
  const title = `Import ${project.name} ${Date.now()}`
  try {
    await openScreen(page, 'Import')
    await chooseFile(page, fileOf(uid, title, 0))
    await expect(row(page, /New/)).toContainText('1')
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await expect(page.getByRole('region', { name: 'What was imported' })).toContainText(
      '1 event added',
    )
    await expect
      .poll(async () => (await findEvent(request, 'calendar', title))?.ics)
      .toContain(`UID:${uid}`)

    // The same file again: it is there already.
    await openScreen(page, 'Import')
    await chooseFile(page, fileOf(uid, title, 0))
    await expect(row(page, /Already up to date/)).toContainText('1')
    await expect(page.getByRole('button', { name: 'Import', exact: true })).toBeDisabled()

    // A newer one: it replaces what is there, after it is asked.
    await openScreen(page, 'Import')
    await chooseFile(page, fileOf(uid, `${title} changed`, 2))
    await expect(row(page, /Replaced/)).toContainText('1')
    await page.getByRole('button', { name: 'Import', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Replace' }).click()
    await expect(page.getByRole('region', { name: 'What was imported' })).toContainText(
      '1 event replaced',
    )
    await expect
      .poll(async () => (await findEvent(request, 'calendar', `${title} changed`))?.ics)
      .toContain('SEQUENCE:2')
  } finally {
    await removeFound(request, 'calendar', `${title} changed`)
    await removeFound(request, 'calendar', title)
  }
})

test('exports a calendar as a file that has its events', async ({ page, request }, { project }) => {
  const title = `Export ${project.name} ${Date.now()}`
  await putEvent(request, {
    slug: 'calendar',
    uid: title.replaceAll(' ', '-'),
    title,
    lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`, 'X-E2E-KEEP:kept'],
  })
  try {
    await openScreen(page, 'Export')
    await expect(page.getByRole('region', { name: 'What will be exported' })).toContainText(
      'File: Calendar.ics',
    )

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Export', exact: true }).click(),
    ])

    expect(download.suggestedFilename()).toBe('Calendar.ics')
    const text = await readFile(await download.path(), 'utf8')
    expect(text).toContain('X-WR-CALNAME:Calendar')
    expect(text).toContain(`SUMMARY:${title}`)
    expect(text).toContain('X-E2E-KEEP:kept')
  } finally {
    await removeFound(request, 'calendar', title)
  }
})
