import { expect, test } from '@playwright/test'

test.describe('english browser', () => {
  test.use({ locale: 'en-US' })

  test('connects, creates an event and lists it', async ({ page }, { project }) => {
    const title = `E2E ${project.name} ${Date.now()}: a, b; c\\d`

    await page.goto('/')
    await expect(page.getByText('Connected to the CalDAV server')).toBeVisible()

    await page.getByLabel('Title').fill(title)
    await page.getByRole('button', { name: 'Add event' }).click()
    await expect(page.getByText(title)).toBeVisible()
    await expect(page.getByLabel('Title')).toHaveValue('')

    // It was stored on the server, not only in the page.
    await page.reload()
    await expect(page.getByText(title)).toBeVisible()
  })
})

test.describe('italian browser', () => {
  test.use({ locale: 'it-IT' })

  test('shows the app in Italian', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Connesso al server CalDAV')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Aggiungi evento' })).toBeVisible()
  })
})
