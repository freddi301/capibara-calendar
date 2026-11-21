import { expect, test } from '../support/seeded.ts'
import { expectNoViolations, openSeeded } from '../support/a11y.ts'

test('the month layout has no detectable accessibility violations', async ({ page }) => {
  // given
  await openSeeded(page)

  // when
  await page.getByRole('button', { name: 'Show the month' }).click()
  await expect(page.getByRole('group', { name: 'Month' })).toBeVisible()

  // then
  await expectNoViolations(page)
})

test('the week rows layout has no detectable accessibility violations', async ({ page }) => {
  // given
  await openSeeded(page)

  // when
  await page.getByRole('button', { name: 'Layouts' }).click()
  await page.getByRole('button', { name: 'Week', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()

  // then
  await expectNoViolations(page)
})

test('the agenda has no detectable accessibility violations', async ({ page }) => {
  // given
  await openSeeded(page)

  // when
  await page.getByRole('button', { name: 'Layouts' }).click()
  await page.getByRole('button', { name: 'Agenda' }).click()
  await expect(page.getByRole('button', { name: 'Layouts' })).toBeVisible()

  // then
  await expectNoViolations(page)
})

test('the layouts screen has no detectable accessibility violations', async ({ page }) => {
  // given
  await openSeeded(page)

  // when
  await page.getByRole('button', { name: 'Layouts' }).click()
  await expect(page.getByRole('heading', { name: 'Layouts' })).toBeVisible()

  // then
  await expectNoViolations(page)
})
