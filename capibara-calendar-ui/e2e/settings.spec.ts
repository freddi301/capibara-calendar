import { expect, test, type Locator, type Page } from '@playwright/test'

// The app talks to the real local Radicale server (started by playwright.config.ts).

const isDark = (page: Page) =>
  page.evaluate(() => document.documentElement.classList.contains('dark'))

async function openSettings(page: Page, name = 'Settings') {
  await page.goto('/')
  await page.getByRole('button', { name }).click()
}

async function choose(page: Page, select: string, option: string) {
  await page.getByRole('combobox', { name: select, exact: true }).click()
  await page.getByRole('option', { name: option }).click()
}

test.describe('language', () => {
  test.use({ locale: 'en-US' })

  test('follows the browser language until another one is chosen', async ({ page }) => {
    await openSettings(page)
    await expect(page.getByRole('combobox', { name: 'Language' })).toContainText('System')

    await choose(page, 'Language', 'Italiano')
    await expect(page.getByRole('heading', { name: 'Impostazioni' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Lingua' })).toContainText('Italiano')

    // The choice is remembered, although the browser still says English. So is the screen.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Impostazioni' })).toBeVisible()

    // Back to the system language, which is forgotten again.
    await choose(page, 'Lingua', 'Sistema')
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Language' })).toContainText('System')
  })
})

test.describe('theme', () => {
  test.use({ colorScheme: 'dark' })

  test('follows the system theme until another one is chosen', async ({ page }) => {
    await openSettings(page)
    expect(await isDark(page)).toBe(true)

    await choose(page, 'Theme', 'Light')
    expect(await isDark(page)).toBe(false)

    // The choice is remembered, although the system is dark.
    await page.reload()
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
    expect(await isDark(page)).toBe(false)

    await choose(page, 'Theme', 'System')
    expect(await isDark(page)).toBe(true)
  })

  test('follows the operating system while no theme is chosen', async ({ page }) => {
    await page.goto('/')
    expect(await isDark(page)).toBe(true)

    await page.emulateMedia({ colorScheme: 'light' })
    await expect.poll(() => isDark(page)).toBe(false)
  })
})

test.describe('stored settings', () => {
  test.use({ locale: 'en-US', colorScheme: 'light' })

  test('are ignored when they are not valid', async ({ page }) => {
    await page.addInitScript(() => {
      const kept = JSON.parse(localStorage.getItem('capibara-calendar') ?? '{}') as object
      const settings = { language: 'fr', theme: 'neon' }
      localStorage.setItem('capibara-calendar', JSON.stringify({ ...kept, settings }))
    })

    await page.goto('/')

    await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
    expect(await isDark(page)).toBe(false)
  })

  test('keep the valid part when the other part is not valid', async ({ page }) => {
    await page.addInitScript(() => {
      const kept = JSON.parse(localStorage.getItem('capibara-calendar') ?? '{}') as object
      const settings = { language: 'fr', theme: 'dark' }
      localStorage.setItem('capibara-calendar', JSON.stringify({ ...kept, settings }))
    })

    await page.goto('/')

    await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
    expect(await isDark(page)).toBe(true)
  })
})

test('the options of the lists are at least as big as the recommended touch target', async ({
  page,
}) => {
  await openSettings(page)

  for (const name of ['Language', 'Theme']) {
    const select = page.getByRole('combobox', { name })
    await select.click()
    await expect(page.getByRole('option').first()).toBeVisible() // the list has finished opening
    for (const option of await page.getByRole('option').all()) {
      expect((await option.boundingBox())?.height).toBeGreaterThanOrEqual(44)
    }
    await page.keyboard.press('Escape')
    await expect(page.getByRole('option')).toHaveCount(0) // and closing
  }
})

test('the selects and the inputs of the settings are as high as a text input', async ({ page }) => {
  await openSettings(page)
  await page.getByRole('button', { name: 'Change' }).click() // the fields of the saved connection
  const height = async (locator: Locator) => Math.round((await locator.boundingBox())?.height ?? 0)

  const text = await height(page.getByLabel('Server address'))
  expect(text).toBeGreaterThan(0)
  for (const name of ['Language', 'Theme', 'Time zone', 'First day of the week']) {
    expect(await height(page.getByRole('combobox', { name })), name).toBe(text)
  }
})

test.describe('first day of the week and time zone', () => {
  test.use({ locale: 'en-US' })

  test('follow the system until another one is chosen', async ({ page }) => {
    await openSettings(page)
    // The system is shown next to System, as secondary text. The browser here is en-US.
    await expect(page.getByRole('combobox', { name: 'First day of the week' })).toContainText(
      'System Sunday',
    )
    await expect(page.getByRole('combobox', { name: 'Language' })).toContainText('System English')

    await choose(page, 'First day of the week', 'Monday')
    await page.getByRole('button', { name: 'Back' }).click()
    const week = page.getByRole('group', { name: 'Week' }).getByRole('button')
    await expect(week.first()).toHaveAccessibleName(/^Monday/)
    await expect(week.last()).toHaveAccessibleName(/^Sunday/)

    // The choice is remembered, then forgotten when it follows the system again.
    await page.reload()
    await expect(week.first()).toHaveAccessibleName(/^Monday/)
    await page.getByRole('button', { name: 'Settings' }).click()
    await choose(page, 'First day of the week', 'System')
    await page.getByRole('button', { name: 'Back' }).click()
    await expect(week.first()).toHaveAccessibleName(/^Sunday/)
  })

  test('the time zone decides what today is, and is remembered', async ({ page }) => {
    await openSettings(page)
    await choose(page, 'Time zone', 'Kiritimati')
    await expect(page.getByRole('combobox', { name: 'Time zone', exact: true })).toContainText(
      'Kiritimati',
    )
    await page.getByRole('button', { name: 'Back' }).click()

    // Kiritimati is 14 hours ahead of UTC. Its date is not always the one of the browser.
    const there = new Date().toLocaleDateString('en-CA', { timeZone: 'Pacific/Kiritimati' })
    await expect(page.getByLabel('Choose a date')).toHaveValue(there)

    await page.reload()
    await expect(page.getByLabel('Choose a date')).toHaveValue(there)
    await page.getByRole('button', { name: 'Settings' }).click()
    await expect(page.getByRole('combobox', { name: 'Time zone', exact: true })).toContainText(
      'Kiritimati',
    )
  })
})
