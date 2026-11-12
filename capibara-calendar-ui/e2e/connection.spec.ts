import { expect, test, type Page } from '@playwright/test'

test.use({ locale: 'en-US', storageState: { cookies: [], origins: [] } })

async function connect(page: Page, address: string) {
  await page.getByLabel('Server address').fill(address)
  await page.getByLabel('Username').fill('dev')
  await page.getByLabel('Password').fill('dev')
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
}

test('opens the settings, with the address to type in, until there is a server', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByLabel('Server address')).toBeFocused()
  await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'New event' })).toHaveCount(0)
})

test('goes to the calendars when the server works, and remembers it', async ({ page }) => {
  await page.goto('/')

  await connect(page, '/radicale/')

  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()
  await expect(page.getByRole('button', { name: 'New event' })).toBeVisible()

  await page.reload()
  await expect(page.getByText('Connected to the CalDAV server')).toBeVisible() // no question again
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByLabel('Server address')).toHaveValue('/radicale/')
  await expect(page.getByLabel('Username')).toHaveValue('dev')
})

test('works with the whole address of the server, as well', async ({ page, baseURL }) => {
  await page.goto('/')

  await connect(page, `${baseURL}/radicale/`)

  await expect(page.getByRole('button', { name: 'New event' })).toBeVisible()
})

test('takes the calls to a server of another address through this site, and they work', async ({
  page,
}, { project }) => {
  const sent: string[] = []
  page.on('request', (request) => sent.push(request.url()))
  await page.goto('/')

  await connect(page, 'http://localhost:5232/') // the server itself, not the path of this site
  await expect(page.getByRole('button', { name: 'New event' })).toBeVisible()

  // Not one call goes from the page to the other address: the browser would not allow it.
  expect(sent.some((url) => url.includes('/api/caldav'))).toBe(true)
  expect(sent.filter((url) => url.startsWith('http://localhost:5232'))).toEqual([])

  // Reading, writing and deleting all work through it.
  const title = `Proxied ${project.name} ${Date.now()}`
  await page.getByRole('button', { name: 'New event' }).click()
  await page.getByRole('combobox', { name: 'Calendar' }).click() // the calendars have come
  await page.getByRole('option').first().click()
  await page.getByLabel('Title').fill(title)
  await page.getByRole('button', { name: 'Save' }).click()
  // The list of the day is long on a server that has been used by the other tests: look for the text.
  await expect(page.getByText(title)).toBeVisible({ timeout: 45_000 })
  await page.getByText(title).click()
  await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
  await page.getByRole('button', { name: 'Delete' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()
  await expect(page.getByText(title)).toHaveCount(0)
})

test('says that the login is not right, when a server says so, and does not ask the browser for it', async ({
  page,
}) => {
  // A server that says no, as a Nextcloud does with a wrong password.
  await page.route('**/api/caldav', (route) =>
    route.fulfill({ status: 401, body: 'no', contentType: 'text/plain' }),
  )
  let dialogs = 0
  page.on('dialog', () => dialogs++)
  await page.goto('/')

  await page.getByLabel('Server address').fill('https://drive.example.org/remote.php/dav')
  await page.getByLabel('Username').fill('ada')
  await page.getByLabel('Password').fill('wrong')
  await page.getByRole('button', { name: 'Connect', exact: true }).click()

  await expect(page.getByRole('alert')).toHaveText(/Wrong username or password\./)
  expect(dialogs).toBe(0)
})

test('says that the server cannot be reached, when the proxy cannot reach it', async ({ page }) => {
  await page.route('**/api/caldav', (route) =>
    route.fulfill({ status: 502, headers: { 'x-caldav-proxy-error': 'true' }, body: 'down' }),
  )
  await page.goto('/')

  await page.getByLabel('Server address').fill('https://drive.example.org/remote.php/dav')
  await page.getByRole('button', { name: 'Connect', exact: true }).click()

  await expect(page.getByRole('alert')).toHaveText(/Cannot reach the CalDAV server/)
})

test('says that the address is not one of a CalDAV server, and keeps what was typed', async ({
  page,
}) => {
  await page.goto('/')

  await connect(page, '/nowhere/')

  await expect(page.getByRole('alert')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByLabel('Server address')).toHaveValue('/nowhere/')
  await expect(page.getByRole('button', { name: 'New event' })).toHaveCount(0)

  await page.reload() // nothing was saved
  await expect(page.getByLabel('Server address')).toHaveValue('')
})

test('asks for an address that is a whole one, or one of this site', async ({ page }) => {
  await page.goto('/')

  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await expect(page.getByText('Enter the address of the server')).toBeVisible()

  await page.getByLabel('Server address').fill('ftp://files.example.org')
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await expect(page.getByText('Enter a valid address')).toBeVisible()
})

test('goes back to asking for a server when it is disconnected', async ({ page }) => {
  await page.goto('/')
  await connect(page, '/radicale/')
  await expect(page.getByRole('button', { name: 'New event' })).toBeVisible()
  await page.getByRole('button', { name: 'Settings' }).click()

  await page.getByRole('button', { name: 'Disconnect' }).click()

  await expect(page.getByLabel('Server address')).toHaveValue('')
  await expect(page.getByRole('button', { name: 'Back' })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()
  await expect(page.getByLabel('Server address')).toBeFocused()
})

test.describe('italian browser', () => {
  test.use({ locale: 'it-IT' })

  test('asks for the server in Italian', async ({ page }) => {
    await page.goto('/')

    await expect(page.getByText('Connessione', { exact: true })).toBeVisible()
    await page.getByLabel('Indirizzo del server').fill('/nowhere/')
    await page.getByRole('button', { name: 'Connetti' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page.getByLabel('Nome utente')).toBeVisible()
  })
})

test('asks for the password in a new session, with the address and the user filled in', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      'capibara-calendar-connection',
      JSON.stringify({ url: '/radicale/', username: 'dev' }),
    )
  })

  await page.goto('/')

  await expect(page.getByText('Enter your password to connect again.')).toBeVisible()
  await expect(page.getByLabel('Password')).toBeFocused()
})
