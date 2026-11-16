import type { Page } from '@playwright/test'
import { expect, test } from './fixtures.ts'
import {
  contacts,
  ensureCalendar,
  ensureContacts,
  findEvent,
  icsDay,
  putEvent,
  removeFound,
} from './calendars.ts'

// These tests talk to the real local Radicale server (started by playwright.config.ts), and to its address book.

test.use({ locale: 'en-US' })

test.beforeAll(async ({ request }) => {
  await ensureCalendar(request, 'calendar', 'Calendar')
  await ensureContacts(request)
})

const unique = (project: string, name: string) => `Patch ${name} ${project} ${Date.now()}`
const uid = (title: string) => title.replaceAll(' ', '-')
const lines = (ics: string, name: string) =>
  ics.split(/\r?\n/).filter((line) => line.startsWith(name))

async function openForEdit(page: Page, title: string) {
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
  await page.getByRole('button', { name: title }).click()
  await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
  await expect(page.getByRole('heading', { name: 'Edit event' })).toBeVisible()
}

test.describe('saving the form', () => {
  test('writes only what was changed: all the other lines of the event stay on the server', async ({
    page,
    request,
  }, { project }) => {
    const title = unique(project.name, 'title')
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [
        `DTSTART;VALUE=DATE:${icsDay(0)}`,
        'GEO:48.8566;2.3522',
        `ATTENDEE;CN=${contacts.ada.name};ROLE=OPT-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE:${contacts.ada.id}`,
        'X-E2E-KEEP:kept',
      ],
    })
    try {
      await openForEdit(page, title)
      await page.getByLabel('Title').fill(`${title} changed`)
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()

      const stored = (await findEvent(request, 'calendar', `${title} changed`))?.ics ?? ''
      expect(stored).toContain(`SUMMARY:${title} changed`)
      expect(stored).toContain('GEO:48.8566;2.3522')
      expect(stored).toContain('X-E2E-KEEP:kept')
      const attendee = lines(stored, 'ATTENDEE').join('\n')
      for (const kept of ['ROLE=OPT-PARTICIPANT', 'PARTSTAT=ACCEPTED', 'RSVP=TRUE']) {
        expect(attendee).toContain(kept)
      }
    } finally {
      await removeFound(request, 'calendar', `${title} changed`)
      await removeFound(request, 'calendar', title)
    }
  })

  test('keeps what another app added after the form was opened, when it is saved anyway', async ({
    page,
    request,
  }, { project }) => {
    const title = unique(project.name, 'desync')
    const original = [
      `DTSTART;VALUE=DATE:${icsDay(0)}`,
      `ATTENDEE;CN=${contacts.ada.name};PARTSTAT=ACCEPTED:${contacts.ada.id}`,
    ]
    await putEvent(request, { slug: 'calendar', uid: uid(title), title, lines: original })
    try {
      await openForEdit(page, title)

      // Another app adds a description, a reminder and a second person.
      await putEvent(request, {
        slug: 'calendar',
        uid: uid(title),
        title,
        lines: [
          ...original,
          `ATTENDEE;CN=${contacts.bruno.name}:${contacts.bruno.id}`,
          'DESCRIPTION:Written by the other app',
          'BEGIN:VALARM',
          'ACTION:DISPLAY',
          'DESCRIPTION:Reminder',
          'TRIGGER:-PT10M',
          'END:VALARM',
        ],
      })

      await page.getByLabel('Title').fill(`${title} mine`)
      await page.getByRole('combobox', { name: `Answer of ${contacts.ada.name}` }).click()
      await page.getByRole('option', { name: 'Declined' }).click()
      await page.getByRole('button', { name: 'Save' }).click()
      const dialog = page.getByRole('alertdialog')
      await expect(dialog).toContainText('This event was changed somewhere else')
      await dialog.getByRole('button', { name: 'Save anyway' }).click()
      await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()

      const stored = (await findEvent(request, 'calendar', `${title} mine`))?.ics ?? ''
      // What the person changed...
      expect(stored).toContain(`SUMMARY:${title} mine`)
      expect(lines(stored, 'ATTENDEE').find((line) => line.includes(contacts.ada.id))).toContain(
        'PARTSTAT=DECLINED',
      )
      // ...and what the other app added, which the form did not know.
      expect(lines(stored, 'ATTENDEE').join('\n')).toContain(contacts.bruno.id)
      expect(stored).toContain('DESCRIPTION:Written by the other app')
      expect(stored).toContain('BEGIN:VALARM')
      expect(stored).toContain('TRIGGER:-PT10M')
    } finally {
      await removeFound(request, 'calendar', `${title} mine`)
      await removeFound(request, 'calendar', title)
    }
  })
})
