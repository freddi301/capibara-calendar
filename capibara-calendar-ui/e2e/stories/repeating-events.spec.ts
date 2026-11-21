import { expect, test } from '../fixtures.ts'
import { ensureCalendar, icsDay, putEvent, removeEvent } from '../calendars.ts'
import { reload, unique, uid, open, chooseLayout, chooseCalendar } from '../support/app.ts'
import { occurrenceOn, expectInAgenda, showDay } from '../support/agenda.ts'

// These tests talk to the real local Radicale server (started by playwright.config.ts).

test.use({ locale: 'en-US' })

test.beforeAll(async ({ request }) => {
  await ensureCalendar(request, 'calendar', 'Calendar')
  await ensureCalendar(request, 'work', 'Work')
})

test.describe('events that repeat', () => {
  test('show every occurrence, are edited as one event, and go all together', async ({
    page,
    request,
  }, { project }) => {
    const title = unique(project.name, 'Repeats')
    // given
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`, 'RRULE:FREQ=WEEKLY;COUNT=3'],
    })
    try {
      // when
      await open(page)
      await chooseLayout(page, 'Agenda')

      // then
      await expectInAgenda(page, title, 3)

      // Any of them opens the event, with the day that it started on.
      await showDay(page, 7)
      await occurrenceOn(page, title, 7).click()
      await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
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
      await expectInAgenda(page, title, 0)
    } finally {
      await removeEvent(request, 'calendar', uid(title))
    }
  })

  test('are changed from an occurrence on, and the ones before stay', async ({ page, request }, {
    project,
  }) => {
    const title = unique(project.name, 'Following')
    // given
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`, 'RRULE:FREQ=WEEKLY;COUNT=4'],
    })
    try {
      // when
      await open(page)
      await chooseLayout(page, 'Agenda')

      // then
      await expectInAgenda(page, title, 4)

      await showDay(page, 14)
      await occurrenceOn(page, title, 14).click()
      await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
      await page.getByRole('button', { name: 'This and following' }).click()
      await expect(
        page.getByText(
          'This event and the ones after it change. The ones before stay as they are.',
        ),
      ).toBeVisible()
      await page.getByLabel('Title').fill(`${title} later`)
      await page.getByRole('button', { name: 'Save' }).click()
      await page.getByRole('button', { name: /^(Back|Close)$/ }).click() // a saved event shows itself first

      await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
      await expectInAgenda(page, title, 2, true)
      await expectInAgenda(page, `${title} later`, 2)

      await reload(page)
      await expectInAgenda(page, title, 2, true)
      await expectInAgenda(page, `${title} later`, 2)

      // And the same for taking them out: the ones before stay.
      await showDay(page, 14)
      await occurrenceOn(page, `${title} later`, 14).click()
      await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
      await page.getByRole('button', { name: 'This and following' }).click()
      await page.getByRole('button', { name: 'Delete' }).click()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
      await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
      await expectInAgenda(page, `${title} later`, 0)
      await expectInAgenda(page, title, 2, true)
    } finally {
      await removeEvent(request, 'calendar', uid(title))
      // The second event of the split has an id of its own: it goes by its title.
    }
  })

  test('are changed one at a time, and one at a time taken out, without touching the others', async ({
    page,
    request,
  }, { project }) => {
    const title = unique(project.name, 'Pick')
    // given
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`, 'RRULE:FREQ=WEEKLY;COUNT=4'],
    })
    try {
      // when
      await open(page)
      await chooseLayout(page, 'Agenda')

      // then
      await expectInAgenda(page, title, 4)

      // Change the second one alone.
      await showDay(page, 7)
      await occurrenceOn(page, title, 7).click()
      await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
      await page.getByRole('button', { name: 'Only this event' }).click()
      await expect(
        page.getByText('Only this event changes. The others of the repeat stay as they are.'),
      ).toBeVisible()
      await page.getByLabel('Title').fill(`${title} moved`)
      await page.getByRole('button', { name: 'Save' }).click()
      await page.getByRole('button', { name: /^(Back|Close)$/ }).click() // a saved event shows itself first
      await expectInAgenda(page, `${title} moved`, 1)
      await expectInAgenda(page, title, 3, true)

      // Take the third one out alone: it was the last but one, and nothing else goes.
      await showDay(page, 14)
      await occurrenceOn(page, title, 14).click()
      await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
      await page.getByRole('button', { name: 'Only this event' }).click()
      await page.getByRole('button', { name: 'Delete' }).click()
      await expect(
        page.getByText('Only this event is deleted. The others of the repeat stay.'),
      ).toBeVisible()
      await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
      await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
      await expectInAgenda(page, title, 2, true)
      await expectInAgenda(page, `${title} moved`, 1)

      // Still true after the page is loaded again: it was written to the server.
      await reload(page)
      await expectInAgenda(page, title, 2, true)
      await expectInAgenda(page, `${title} moved`, 1)
    } finally {
      await removeEvent(request, 'calendar', uid(title))
    }
  })

  test('are made from an event, and stop at the day that was said', async ({ page }, {
    project,
  }) => {
    const title = unique(project.name, 'Make')
    // given
    await open(page)

    // when
    await page.getByRole('button', { name: 'New event' }).click()
    await page.getByLabel('Title').fill(title)
    await chooseCalendar(page)
    await page.getByRole('combobox', { name: 'Repeat', exact: true }).click()
    await page.getByRole('option', { name: 'Day', exact: true }).click()
    await page.getByRole('combobox', { name: 'How the repeat ends' }).click()
    await page.getByRole('option', { name: 'Ends on' }).click()
    const last = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    await page.getByLabel('Repeat until').fill(last)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()

    await chooseLayout(page, 'Agenda')

    // then
    await expectInAgenda(page, title, 4) // today and three days

    // And the repeat is taken away from all of them: one is left.
    await showDay(page, 0)
    await page.getByRole('button', { name: title }).first().click()
    await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
    await page.getByRole('button', { name: 'All events' }).click()
    await page.getByRole('combobox', { name: 'Repeat', exact: true }).click()
    await page.getByRole('option', { name: 'Does not repeat' }).click()
    await page.getByRole('button', { name: 'Save' }).click()
    await page.getByRole('button', { name: /^(Back|Close)$/ }).click() // a saved event shows itself first
    await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
    await expectInAgenda(page, title, 1)

    await showDay(page, 0)
    await page.getByRole('button', { name: title }).click()
    await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
    await page.getByRole('button', { name: 'Delete' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
    await expectInAgenda(page, title, 0)
  })

  test('are shown on each day of the repeat, and no more than that', async ({ page, request }, {
    project,
  }) => {
    const title = unique(project.name, 'Daily')
    // given
    await putEvent(request, {
      slug: 'calendar',
      uid: uid(title),
      title,
      lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`, 'RRULE:FREQ=DAILY;COUNT=20'],
    })
    try {
      // when
      await open(page)
      await chooseLayout(page, 'Agenda')

      // then

      await expectInAgenda(page, title, 20)
    } finally {
      await removeEvent(request, 'calendar', uid(title))
    }
  })
})
