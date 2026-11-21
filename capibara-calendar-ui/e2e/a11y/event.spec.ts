import { expect, test } from '../support/seeded.ts'
import { expectNoViolations, expectNoViolationsOnceSettled, openSeeded } from '../support/a11y.ts'

test('the event list has no detectable accessibility violations', async ({ page }) => {
  // given
  await openSeeded(page)

  // then
  await expectNoViolations(page)
})

test('the new event screen has no detectable accessibility violations', async ({ page }) => {
  // given
  await openSeeded(page)

  // when
  await page.getByRole('button', { name: 'New event' }).click()
  await expect(page.getByRole('heading', { name: 'New event' })).toBeVisible()

  // then
  await expectNoViolations(page)
})

test('the edit event screen has no detectable accessibility violations', async ({ page }) => {
  // given
  await openSeeded(page)

  // when
  await page.getByRole('button', { name: /Design review/ }).click()
  await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
  await expect(page.getByRole('heading', { name: 'Edit event' })).toBeVisible()

  // then
  await expectNoViolations(page)
})

test('the repeat rows of the event have no detectable accessibility violations', async ({
  page,
}) => {
  // given
  await openSeeded(page)

  // when
  await page.getByRole('button', { name: 'New event' }).click()
  await page.getByRole('combobox', { name: 'Repeat', exact: true }).click()
  await page.getByRole('option', { name: 'Week', exact: true }).click()
  await page.getByRole('combobox', { name: 'How the repeat ends' }).click()
  await page.getByRole('option', { name: 'Ends after' }).click()
  await expect(page.getByLabel('Repeat this many times')).toBeVisible()

  // then
  await expectNoViolations(page)
})

test('the question about deleting an event has no detectable accessibility violations', async ({
  page,
}) => {
  // given
  await openSeeded(page)

  // when
  await page.getByRole('button', { name: /Design review/ }).click()
  await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()

  // then
  await expectNoViolations(page)
})

test('the problems of the form have no detectable accessibility violations', async ({ page }) => {
  // given
  await openSeeded(page)

  // when
  await page.getByRole('button', { name: 'New event' }).click()
  await page.getByLabel('Start date').fill('2026-12-05')
  await page.getByLabel('End date').fill('2026-12-01')
  await page.getByRole('button', { name: 'Save' }).click()
  await expect(page.getByText('Enter a title')).toBeVisible()
  await expect(page.getByText('The end cannot be before the start')).toBeVisible()

  // then
  await expectNoViolations(page)
})

test('the question about deleting an event has no violations in the dark theme', async ({
  page,
}) => {
  // given
  await openSeeded(page, '&theme=dark')

  // when
  await page.getByRole('button', { name: /Design review/ }).click()
  await page.getByRole('button', { name: 'Edit' }).click() // it is only looked at, at first
  await page.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByRole('alertdialog')).toBeVisible()
  await expect(page.locator('html')).toHaveClass(/dark/)

  // then
  await expectNoViolationsOnceSettled(page)
})
