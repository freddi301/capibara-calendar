import { expect, test } from '../support/seeded.ts'
import { expectNoViolations, expectNoViolationsOnceSettled, openSeeded } from '../support/a11y.ts'

test('the settings screen has no detectable accessibility violations', async ({ page }) => {
  // given
  await openSeeded(page)

  // when
  await page.getByRole('button', { name: 'Settings' }).click()
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible()

  // then
  await expectNoViolations(page)
})

test('the calendars screen has no detectable accessibility violations', async ({ page }) => {
  // given
  await openSeeded(page)

  // when
  await page.getByRole('button', { name: 'Calendars' }).click()
  await expect(page.getByRole('switch').first()).toBeVisible()

  // then
  await expectNoViolations(page)
})

test('the filter screen, with rules, has no detectable accessibility violations', async ({
  page,
}) => {
  // given
  await openSeeded(page)

  // when
  await page.getByRole('button', { name: 'Filter' }).click()
  await page.getByRole('button', { name: 'Add rule' }).click()
  await page.getByRole('menuitem', { name: /Title/ }).click()
  await page.getByRole('textbox', { name: 'Title' }).fill('dentist')
  await page.getByRole('button', { name: 'Add rule' }).click()
  await page.getByRole('menuitem', { name: /People/ }).click()
  await expect(page.getByRole('textbox', { name: 'Title' })).toBeVisible()

  // then
  await expectNoViolations(page)
})

test('the filter screen has no detectable accessibility violations in the dark theme', async ({
  page,
}) => {
  // given
  await openSeeded(page, '&theme=dark')

  // when
  await page.getByRole('button', { name: 'Filter' }).click()
  await page.getByRole('button', { name: 'Add rule' }).click()
  await page.getByRole('menuitem', { name: /Status/ }).click()

  // then
  await expectNoViolationsOnceSettled(page)
})

test('the dark theme has no detectable accessibility violations', async ({ page }) => {
  // given
  await openSeeded(page, '&theme=dark')

  // then
  await expectNoViolations(page)

  // when
  await page.getByRole('button', { name: 'Calendars' }).click()
  await expect(page.getByRole('switch').first()).toBeVisible()

  // then
  await expectNoViolationsOnceSettled(page)
})
