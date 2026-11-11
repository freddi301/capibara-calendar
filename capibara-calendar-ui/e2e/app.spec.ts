import { expect, test } from '@playwright/test'

test.describe('english browser', () => {
  test.use({ locale: 'en-US' })

  test('shows the app in English', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { name: 'Capibara Calendar' })).toBeVisible()
    await expect(page.getByText('Your calendars, in one place')).toBeVisible()
  })
})

test.describe('italian browser', () => {
  test.use({ locale: 'it-IT' })

  test('shows the app in Italian', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('I tuoi calendari, in un unico posto')).toBeVisible()
  })
})
