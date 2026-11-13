import { expect, test, type Page } from '@playwright/test'
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

const unique = (project: string, name: string) => `Attendees ${name} ${project} ${Date.now()}`
const uid = (title: string) => title.replaceAll(' ', '-')
const lines = (ics: string, name: string) =>
  ics.split(/\r?\n/).filter((line) => line.startsWith(name))

async function open(page: Page) {
  await page.goto('/')
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
}

async function openEvent(page: Page, title: string) {
  await open(page)
  await page.getByRole('button', { name: title }).click()
}

async function pickContact(page: Page, name: string) {
  await page.getByRole('button', { name: 'Add attendee' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Search contacts').fill(name.split(' ')[0])
  await dialog.getByRole('button', { name }).click()
}

const attendee = (contact: { name: string; id: string }, parameters = '') =>
  `ATTENDEE;CN=${contact.name}${parameters}:${contact.id}`

test.describe('the attendees of an event', () => {
  test('are added from the contacts, answered, and shown on the event and in the list', async ({
    page,
    request,
  }, { project }) => {
    const title = unique(project.name, 'add')
    try {
      await open(page)
      await page.getByRole('button', { name: 'New event' }).click()
      await page.getByLabel('Title').fill(title)
      await page.getByRole('combobox', { name: 'Calendar' }).click()
      await page.getByRole('option', { name: 'Calendar', exact: true }).click()

      await pickContact(page, contacts.ada.name)
      await page.getByRole('button', { name: 'Add attendee' }).click()
      // The one that is there is not offered again.
      await expect(
        page.getByRole('dialog').getByRole('button', { name: contacts.ada.name }),
      ).toHaveCount(0)
      await page.getByRole('dialog').getByLabel('Search contacts').fill('Bruno')
      await page.getByRole('dialog').getByRole('button', { name: contacts.bruno.name }).click()
      await page.getByRole('combobox', { name: `Answer of ${contacts.ada.name}` }).click()
      await page.getByRole('option', { name: 'Accepted' }).click()
      await page.getByRole('button', { name: 'Save' }).click()

      // In the list the event has the sign of the people, whatever they answered.
      const card = page.getByRole('button', { name: title })
      await expect(card).toBeVisible()
      await expect(card.locator('svg.lucide-users')).toBeVisible()

      await card.click()
      await expect(page.getByText(contacts.ada.name)).toBeVisible()
      await expect(page.getByText(contacts.bruno.name)).toBeVisible()
      await expect(page.locator('span[title="Accepted"]')).toHaveText('1')
      await expect(page.locator('span[title="No answer"]')).toHaveText('1')

      const stored = await findEvent(request, 'calendar', title)
      expect(stored?.ics).toBeDefined()
      const attendees = lines(stored?.ics ?? '', 'ATTENDEE')
      expect(attendees).toHaveLength(2)
      expect(attendees.join('\n')).toContain('PARTSTAT=ACCEPTED')
      expect(attendees.join('\n')).toContain('SCHEDULE-AGENT=NONE') // the server is not to send anything
      expect(stored?.ics).not.toContain('ORGANIZER')
    } finally {
      await removeFound(request, 'calendar', title)
    }
  })

  test('are changed and taken out, and the rest of the lines stays as the other app wrote it', async ({
    page,
    request,
  }, { project }) => {
    const title = unique(project.name, 'change')
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [
        `DTSTART;VALUE=DATE:${icsDay(0)}`,
        attendee(contacts.ada, ';ROLE=OPT-PARTICIPANT;PARTSTAT=ACCEPTED;RSVP=TRUE'),
        attendee(contacts.bruno),
        'X-E2E-KEEP:kept',
      ],
    })
    try {
      await openEvent(page, title)
      await page.getByRole('button', { name: 'Edit' }).click()
      await page.getByRole('combobox', { name: `Answer of ${contacts.ada.name}` }).click()
      await page.getByRole('option', { name: 'Declined' }).click()
      await page.getByRole('button', { name: `Remove ${contacts.bruno.name}` }).click()
      await page.getByRole('button', { name: 'Save' }).click()

      // The event that was saved is looked at again.
      await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
      await expect(page.locator('span[title="Declined"]')).toHaveText('1')

      const stored = (await findEvent(request, 'calendar', title))?.ics ?? ''
      const attendees = lines(stored, 'ATTENDEE')
      expect(attendees).toHaveLength(1)
      expect(attendees[0]).toContain('PARTSTAT=DECLINED')
      for (const kept of ['ROLE=OPT-PARTICIPANT', 'RSVP=TRUE', `CN=${contacts.ada.name}`]) {
        expect(attendees[0]).toContain(kept)
      }
      expect(stored).not.toContain(contacts.bruno.name)
      expect(stored).toContain('X-E2E-KEEP:kept')
    } finally {
      await removeFound(request, 'calendar', title)
    }
  })

  test('that are not contacts are shown as unknown, and are kept when something else is changed', async ({
    page,
    request,
  }, { project }) => {
    const title = unique(project.name, 'unknown')
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [
        `DTSTART;VALUE=DATE:${icsDay(0)}`,
        attendee(contacts.ada),
        'ATTENDEE;CN=Stranger;PARTSTAT=ACCEPTED:mailto:stranger@example.org',
      ],
    })
    try {
      const unknown = page.getByText('Unknown', { exact: true })
      await openEvent(page, title)
      await expect(page.getByText(contacts.ada.name)).toBeVisible() // the contacts are in
      await expect(unknown).toHaveCount(1)

      await page.getByRole('button', { name: 'Edit' }).click()
      await expect(page.getByText(contacts.ada.name)).toBeVisible()
      await expect(unknown).toHaveCount(1)
      await page.getByLabel('Title').fill(`${title} changed`)
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()

      const stored = (await findEvent(request, 'calendar', `${title} changed`))?.ics ?? ''
      const stranger = lines(stored, 'ATTENDEE').filter((line) =>
        line.includes('stranger@example.org'),
      )
      expect(stranger).toHaveLength(1)
      expect(stranger[0]).toContain('CN=Stranger')
      expect(stranger[0]).toContain('PARTSTAT=ACCEPTED')
    } finally {
      await removeFound(request, 'calendar', `${title} changed`)
      await removeFound(request, 'calendar', title)
    }
  })

  test('cannot be changed when the event has an organizer, and stay as they are', async ({
    page,
    request,
  }, { project }) => {
    const title = unique(project.name, 'organizer')
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [
        `DTSTART;VALUE=DATE:${icsDay(0)}`,
        'ORGANIZER;CN=Boss:mailto:boss@example.org',
        attendee(contacts.ada, ';PARTSTAT=ACCEPTED'),
        attendee(contacts.bruno, ';PARTSTAT=TENTATIVE'),
      ],
    })
    try {
      await openEvent(page, title)
      await expect(page.locator('span[title="Accepted"]')).toHaveText('1')
      await expect(page.locator('span[title="Maybe"]')).toHaveText('1')

      await page.getByRole('button', { name: 'Edit' }).click()
      await expect(page.getByText(contacts.ada.name)).toBeVisible()
      await expect(page.getByRole('button', { name: 'Add attendee' })).toHaveCount(0)
      await expect(
        page.getByRole('combobox', { name: `Answer of ${contacts.ada.name}` }),
      ).toHaveCount(0)
      await expect(page.getByRole('button', { name: `Remove ${contacts.ada.name}` })).toHaveCount(0)

      await page.getByLabel('Title').fill(`${title} changed`)
      await page.getByRole('button', { name: 'Save' }).click()
      await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()

      const stored = (await findEvent(request, 'calendar', `${title} changed`))?.ics ?? ''
      expect(stored).toContain('mailto:boss@example.org')
      expect(stored).toContain('CN=Boss')
      const attendees = lines(stored, 'ATTENDEE').join('\n')
      expect(lines(stored, 'ATTENDEE')).toHaveLength(2)
      expect(attendees).toContain('PARTSTAT=ACCEPTED')
      expect(attendees).toContain('PARTSTAT=TENTATIVE')
      expect(attendees).not.toContain('SCHEDULE-AGENT') // the lines of someone else are not touched
    } finally {
      await removeFound(request, 'calendar', `${title} changed`)
      await removeFound(request, 'calendar', title)
    }
  })
})
