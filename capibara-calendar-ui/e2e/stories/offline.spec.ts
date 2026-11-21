import { expect, test } from '../fixtures.ts'
import { server } from '../servers.ts'
import { ensureCalendar, findEvent, icsDay, putEvent, removeEvent } from '../calendars.ts'

test.use({ locale: 'en-US' })

test.beforeAll(async ({ request }) => {
  await ensureCalendar(request, 'calendar', 'Calendar')
})

test('shows the last events that were loaded when the server cannot be reached', async ({
  page,
  request,
}, { project }) => {
  const title = `Remember ${project.name} ${Date.now()}`
  const uid = title.replaceAll(' ', '-')
  await putEvent(request, {
    slug: 'calendar',
    uid,
    title,
    lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`],
  })
  try {
    await page.goto('/')
    await expect(page.getByRole('button', { name: title })).toBeVisible()
    await page.waitForTimeout(1500) // it is written to the database of the browser a moment later

    await page.route(new RegExp(server().root), (route) => route.abort())
    await page.reload()

    await expect(page.getByRole('button', { name: title })).toBeVisible() // from the database
    await expect(page.getByRole('group', { name: 'Week' })).toBeVisible() // and the screen is there
  } finally {
    await removeEvent(request, 'calendar', uid)
  }
})

test('does not save an event while offline, and saves it when the connection is back', async ({
  page,
  context,
  request,
}, { project }) => {
  const title = `Offline edit ${project.name} ${Date.now()}`
  const uid = title.replaceAll(' ', '-')
  await putEvent(request, {
    slug: 'calendar',
    uid,
    title,
    lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`],
  })
  try {
    await page.goto('/')
    await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
    await page.getByRole('button', { name: title }).click()
    await page.getByRole('button', { name: 'Edit' }).click()
    await page.getByLabel('Title').fill(`${title} changed`)

    await context.setOffline(true)
    await page.getByRole('button', { name: 'Save' }).click()
    await expect(page.getByText('Cannot reach the CalDAV server')).toBeVisible() // it does not wait
    expect((await findEvent(request, 'calendar', `${title} changed`))?.ics).toBeUndefined()

    await context.setOffline(false)
    await page.getByRole('button', { name: 'Try again' }).click()
    await expect(page.getByRole('button', { name: 'Edit' })).toBeVisible()
    expect((await findEvent(request, 'calendar', `${title} changed`))?.ics).toContain(
      `SUMMARY:${title} changed`,
    )
  } finally {
    await context.setOffline(false)
    await removeEvent(request, 'calendar', uid)
  }
})

test('does not keep the events of a connection that was ended', async ({ page, request }, {
  project,
}) => {
  const title = `Remember ${project.name} ${Date.now()}`
  const uid = title.replaceAll(' ', '-')
  await putEvent(request, {
    slug: 'calendar',
    uid,
    title,
    lines: [`DTSTART;VALUE=DATE:${icsDay(0)}`],
  })
  try {
    await page.goto('/')
    await expect(page.getByRole('button', { name: title })).toBeVisible()
    await page.waitForTimeout(1500)

    await page.getByRole('button', { name: 'Settings' }).click()
    await page.getByRole('button', { name: 'Change' }).click()
    await page.getByRole('button', { name: 'Disconnect' }).click()
    await expect(page.getByLabel('Password')).toBeVisible()
    await page.waitForTimeout(1500) // what is written after the end is of a cache that is empty
    const events = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          const open = indexedDB.open('keyval-store')
          open.onsuccess = () => {
            const get = open.result
              .transaction('keyval')
              .objectStore('keyval')
              .get('capibara-calendar-query-cache')
            get.onsuccess = () => {
              const kept = get.result as
                { clientState?: { queries: { queryKey: unknown[] }[] } } | undefined
              resolve(
                kept?.clientState?.queries.filter(({ queryKey }) => queryKey[0] === 'events')
                  .length ?? 0,
              )
            }
          }
          open.onerror = () => {
            resolve(0)
          }
        }),
    )
    expect(events).toBe(0)
  } finally {
    await removeEvent(request, 'calendar', uid)
  }
})
